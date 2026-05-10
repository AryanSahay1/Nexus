package com.nexos.ai.domain.model

data class OcrResult(
    val rawText: String,
    val cleanText: String,
    val blocks: List<String>,
    val confidence: Float,
    val isSuccess: Boolean,
    val error: String? = null,
)
