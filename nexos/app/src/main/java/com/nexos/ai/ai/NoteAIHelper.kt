package com.nexos.ai.ai

import com.google.gson.JsonParser
import com.nexos.ai.domain.model.ParsedNote

/**
 * Helpers around AI responses: prompt builders, JSON parsing, and
 * deterministic local fallback note generation.
 */
object NoteAIHelper {

    /** Parse a `{ title, bullets, summary }` JSON object, tolerant of stray text. */
    fun parseAiJson(raw: String): ParsedNote? = try {
        val trimmed = raw.trim().let { extractFirstJsonObject(it) ?: it }
        val obj = JsonParser.parseString(trimmed).asJsonObject

        val title = obj["title"]?.takeIf { !it.isJsonNull }?.asString.orEmpty().ifBlank { "Untitled note" }
        val summary = obj["summary"]?.takeIf { !it.isJsonNull }?.asString.orEmpty()
        val bullets = obj["bullets"]
            ?.takeIf { it.isJsonArray }
            ?.asJsonArray
            ?.mapNotNull { runCatching { it.asString }.getOrNull() }
            .orEmpty()
        ParsedNote(title.take(120), bullets.take(8), summary.take(400))
    } catch (e: Exception) {
        null
    }

    /** Generate a structured note locally without any AI call. */
    fun parseFromRawText(text: String): ParsedNote {
        val cleaned = text.trim().replace(Regex("\\s+"), " ")
        if (cleaned.isEmpty()) {
            return ParsedNote(title = "Empty capture", bullets = emptyList(), summary = "")
        }
        val firstLine = text.lineSequence()
            .map { it.trim() }
            .firstOrNull { it.isNotBlank() }
            ?.take(60)
            ?: cleaned.take(60)

        val sentences = cleaned.split(Regex("(?<=[.!?])\\s+"))
            .filter { it.isNotBlank() }
            .map { it.trim() }
        val bullets = sentences.take(5).map { it.removeSuffix(".").take(120) }
        val summary = sentences.firstOrNull()?.take(200).orEmpty()
        val title = (firstLine.ifBlank { sentences.firstOrNull()?.take(40).orEmpty() })
            .replace(Regex("[\\r\\n]"), " ")
            .ifBlank { "Captured note" }

        return ParsedNote(title = title, bullets = bullets, summary = summary)
    }

    private fun extractFirstJsonObject(s: String): String? {
        val start = s.indexOf('{')
        if (start < 0) return null
        var depth = 0
        for (i in start until s.length) {
            when (s[i]) {
                '{' -> depth++
                '}' -> { depth--; if (depth == 0) return s.substring(start, i + 1) }
            }
        }
        return null
    }
}
