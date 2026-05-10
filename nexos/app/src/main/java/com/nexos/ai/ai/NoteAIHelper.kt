package com.nexos.ai.ai

import com.google.gson.JsonParser
import com.nexos.ai.domain.model.ParsedNote

object NoteAIHelper {

    /** Parse AI JSON output into a ParsedNote. Falls back to a sensible default. */
    fun parseJson(raw: String): ParsedNote {
        val cleaned = stripCodeFences(raw).trim()
        return try {
            val obj = JsonParser.parseString(cleaned).asJsonObject
            ParsedNote(
                title = obj.get("title")?.asString.orEmpty().ifBlank { autoTitle(cleaned) },
                bullets = obj.getAsJsonArray("bullets")
                    ?.map { it.asString }
                    ?.filter { it.isNotBlank() }
                    .orEmpty(),
                summary = obj.get("summary")?.asString.orEmpty(),
            )
        } catch (t: Throwable) {
            fallback(cleaned)
        }
    }

    /** Build a ParsedNote from raw text without AI assistance. */
    fun fallback(text: String): ParsedNote {
        val firstLine = text.lineSequence().firstOrNull { it.isNotBlank() }?.trim().orEmpty()
        val title = firstLine.take(64).ifBlank { "Untitled note" }
        val bullets = text.lineSequence()
            .map { it.trim() }
            .filter { it.length in 3..160 }
            .take(6)
            .toList()
        return ParsedNote(
            title = title,
            bullets = bullets,
            summary = firstLine.take(180),
        )
    }

    private fun stripCodeFences(s: String): String =
        s.replace("```json", "").replace("```", "")

    private fun autoTitle(text: String): String =
        text.lineSequence().firstOrNull { it.isNotBlank() }?.trim()?.take(64) ?: "Untitled note"
}
