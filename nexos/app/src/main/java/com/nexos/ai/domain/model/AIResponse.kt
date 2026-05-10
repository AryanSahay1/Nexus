package com.nexos.ai.domain.model

data class AIResponse(
    val text: String,
    val isSuccess: Boolean,
    val error: String? = null,
    val provider: String = "",
    val tokensUsed: Int = 0,
)

data class ParsedNote(
    val title: String,
    val bullets: List<String>,
    val summary: String,
)
