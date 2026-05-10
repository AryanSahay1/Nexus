package com.nexos.ai.data.remote.dto

data class GeminiRequest(
    val contents: List<GeminiContent>,
    val generationConfig: GeminiGenerationConfig? = null,
)

data class GeminiContent(
    val parts: List<GeminiPart>,
    val role: String = "user",
)

data class GeminiPart(val text: String)

data class GeminiGenerationConfig(
    val maxOutputTokens: Int = 800,
    val temperature: Double = 0.4,
)

data class GeminiResponse(
    val candidates: List<GeminiCandidate> = emptyList(),
)

data class GeminiCandidate(
    val content: GeminiContent? = null,
)
