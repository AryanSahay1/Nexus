package com.nexus.app.data.tools

import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.domain.agent.Tool
import com.nexus.app.domain.agent.ToolSummary
import javax.inject.Inject
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonPrimitive

/**
 * Creator tools that help the user *plan* design and social media work
 * without calling any third-party API. They produce drafts the user can copy
 * into Canva, CapCut, Instagram, or wherever — keeping Nexus on the safe
 * side of every platform's review process (no Canva/Instagram tokens, no
 * sensitive Google scopes).
 */

class DesignBriefTool @Inject constructor() : Tool {
    override val name = "design_brief"
    override val description =
        "Drafts a creative brief the user can paste into Canva (or any design tool). " +
            "Returns a structured object with title, subtitle, palette, fonts and copy blocks. " +
            "Does NOT upload, post, or call any external service."
    override val isDestructive = false
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{
            "purpose":{"type":"string","description":"What is the design for? e.g. Instagram post, birthday card, business flyer."},
            "audience":{"type":"string","description":"Who's it for? e.g. parents, my college class, neighbours."},
            "vibe":{"type":"string","description":"Adjectives — calm, playful, formal, festive."},
            "headline":{"type":"string","description":"Optional — the main line of text on the design."},
            "body":{"type":"string","description":"Optional — supporting text under the headline."}
          },"required":["purpose","audience"]}"""
    )

    override fun summarize(argumentsJson: String): ToolSummary {
        val a = parseArguments(argumentsJson)
        return ToolSummary(
            title = "Draft a design brief",
            detail = "for ${a["purpose"]?.jsonPrimitive?.content ?: "?"}"
        )
    }

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val a = parseArguments(argumentsJson)
        val purpose = a["purpose"]?.jsonPrimitive?.content
        val audience = a["audience"]?.jsonPrimitive?.content
        if (purpose.isNullOrBlank() || audience.isNullOrBlank()) {
            return NexusResult.err(
                NexusError(NexusErrorCode.INVALID_PARAMETER, "purpose and audience are required")
            )
        }
        val vibe = a["vibe"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() } ?: "warm and clear"
        val headline = a["headline"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
        val body = a["body"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }

        return NexusResult.ok(toolJson {
            put("purpose", purpose)
            put("audience", audience)
            put("vibe", vibe)
            put("recommended_palette", paletteFor(vibe))
            put("recommended_fonts", fontsFor(vibe))
            put("aspect_ratio", aspectFor(purpose))
            put("headline", headline ?: suggestedHeadline(purpose, vibe))
            put("body", body ?: suggestedBody(purpose, audience))
            put("call_to_action", suggestedCta(purpose))
            put(
                "next_steps",
                "Open Canva, choose the suggested aspect ratio template, paste these copy blocks, " +
                    "and pick colours close to the recommended palette."
            )
        })
    }

    private fun paletteFor(vibe: String): String = when {
        vibe.contains("festive", ignoreCase = true) -> "deep red #B91C1C, gold #F59E0B, ivory #FFFBEB"
        vibe.contains("formal", ignoreCase = true) -> "navy #0F172A, slate #475569, warm white #F8FAFC"
        vibe.contains("playful", ignoreCase = true) -> "coral #F472B6, mint #22D3EE, butter #FDE68A"
        vibe.contains("calm", ignoreCase = true) -> "sage #84CC16, sand #FDE68A, fog #E2E8F0"
        else -> "lavender #7C5CFF, teal #22D3EE, off-white #F4F4FB"
    }

    private fun fontsFor(vibe: String): String = when {
        vibe.contains("formal", ignoreCase = true) -> "Playfair Display (heading) + Inter (body)"
        vibe.contains("playful", ignoreCase = true) -> "Fraunces (heading) + Nunito (body)"
        else -> "Poppins (heading) + Inter (body)"
    }

    private fun aspectFor(purpose: String): String = when {
        purpose.contains("instagram post", ignoreCase = true) -> "1080×1080 (square)"
        purpose.contains("instagram story", ignoreCase = true) -> "1080×1920 (vertical)"
        purpose.contains("reel", ignoreCase = true) -> "1080×1920 (vertical)"
        purpose.contains("youtube", ignoreCase = true) -> "1920×1080 (landscape)"
        purpose.contains("flyer", ignoreCase = true) -> "1080×1350 (4:5 portrait)"
        else -> "1080×1080 (square)"
    }

    private fun suggestedHeadline(purpose: String, vibe: String): String = when {
        purpose.contains("birthday", ignoreCase = true) -> "Happy Birthday!"
        purpose.contains("invite", ignoreCase = true) -> "You're invited."
        purpose.contains("flyer", ignoreCase = true) -> "Save the date"
        else -> "Hello — and thank you for being here."
    }.let { base -> if (vibe.contains("festive", ignoreCase = true)) "$base ✨" else base }

    private fun suggestedBody(purpose: String, audience: String): String =
        "Write 1–2 sentences for $audience about $purpose. Keep it friendly and concrete."

    private fun suggestedCta(purpose: String): String = when {
        purpose.contains("invite", ignoreCase = true) -> "RSVP by tapping the link in bio."
        purpose.contains("flyer", ignoreCase = true) -> "Call us or visit the website."
        purpose.contains("instagram", ignoreCase = true) -> "Tap follow for more."
        else -> "Reply to share your thoughts."
    }
}

class SocialPostPlanTool @Inject constructor() : Tool {
    override val name = "social_post_plan"
    override val description =
        "Drafts a social media post — caption, hashtag list, and posting checklist — without " +
            "calling any social media API. The user copies the result into Instagram, Facebook, " +
            "or wherever they post by hand."
    override val isDestructive = false
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{
            "platform":{"type":"string","description":"instagram | facebook | x | linkedin | youtube"},
            "topic":{"type":"string","description":"What is the post about?"},
            "tone":{"type":"string","description":"casual | professional | playful | grateful"},
            "include_hashtags":{"type":"boolean"}
          },"required":["platform","topic"]}"""
    )

    override fun summarize(argumentsJson: String): ToolSummary {
        val a = parseArguments(argumentsJson)
        return ToolSummary(
            title = "Draft a social post",
            detail = "${a["platform"]?.jsonPrimitive?.content ?: "?"} — ${a["topic"]?.jsonPrimitive?.content ?: "?"}"
        )
    }

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val a = parseArguments(argumentsJson)
        val platform = a["platform"]?.jsonPrimitive?.content?.lowercase()
        val topic = a["topic"]?.jsonPrimitive?.content
        if (platform.isNullOrBlank() || topic.isNullOrBlank()) {
            return NexusResult.err(
                NexusError(NexusErrorCode.INVALID_PARAMETER, "platform and topic are required")
            )
        }
        val tone = a["tone"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() } ?: "casual"
        val includeHashtags = a["include_hashtags"]?.jsonPrimitive?.content?.toBooleanStrictOrNull()
            ?: (platform == "instagram" || platform == "x")

        return NexusResult.ok(toolJson {
            put("platform", platform)
            put("topic", topic)
            put("tone", tone)
            put("character_limit", limitFor(platform))
            put(
                "caption_template",
                "Write 1–3 sentences about \"$topic\" in a $tone tone. " +
                    "Open with a hook (a question or a surprising fact). " +
                    "Close with a clear next step for the reader."
            )
            if (includeHashtags) {
                put(
                    "hashtag_template",
                    "Pick 5–8 hashtags split between three buckets: " +
                        "(1) topic-specific (#${topic.replace(" ", "").take(20)}), " +
                        "(2) audience (#community, #firsttime), " +
                        "(3) general / discovery (use sparingly)."
                )
            }
            put(
                "checklist",
                "1. Re-read the caption out loud — does it sound like you? " +
                    "2. Tag at most one or two people. " +
                    "3. Pick the audience visibility (Public / Friends). " +
                    "4. Schedule for a time when your followers are online. " +
                    "5. Hit Post."
            )
            put(
                "safety_note",
                "Do not include phone numbers, addresses, or photos of children's faces in public posts."
            )
        })
    }

    private fun limitFor(platform: String): Int = when (platform) {
        "x", "twitter" -> 280
        "instagram" -> 2200
        "linkedin" -> 3000
        "facebook" -> 63206
        "youtube" -> 5000
        else -> 1000
    }
}
