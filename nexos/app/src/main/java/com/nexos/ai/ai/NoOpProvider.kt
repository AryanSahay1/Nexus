package com.nexos.ai.ai

import com.nexos.ai.domain.model.AIResponse
import com.nexos.ai.domain.model.ParsedNote
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Fallback used when no API key is configured. Generates a deterministic
 * heuristic summary that mimics the JSON shape real providers return.
 */
@Singleton
class NoOpProvider @Inject constructor() : AIProvider {
    override val name        = "Local"
    override val providerKey = "none"

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse {
        val source = extractSourceFromPrompt(prompt)
        val parsed = NoteAIHelper.parseFromRawText(source)
        val json = """{"title":"${parsed.title.jsonEscape()}","bullets":${parsed.bullets.toJsonArray()},"summary":"${parsed.summary.jsonEscape()}"}"""
        return AIResponse(text = json, isSuccess = true, provider = providerKey)
    }

    override suspend fun testConnection(): Boolean = true

    private fun extractSourceFromPrompt(prompt: String): String {
        val markers = listOf("Raw OCR text:", "Transcript:")
        for (m in markers) {
            val idx = prompt.indexOf(m)
            if (idx >= 0) return prompt.substring(idx + m.length).trim()
        }
        return prompt
    }

    private fun String.jsonEscape() = replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ")
    private fun List<String>.toJsonArray(): String =
        joinToString(prefix = "[", postfix = "]") { "\"${it.jsonEscape()}\"" }
}
