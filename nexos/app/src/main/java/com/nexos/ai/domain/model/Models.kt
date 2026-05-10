package com.nexos.ai.domain.model

import com.nexos.ai.data.local.entity.Note

/** Outcome of running ML Kit OCR over a bitmap. */
data class OcrResult(
    val rawText: String,
    val cleanText: String,
    val blocks: List<String>,
    val confidence: Float,
    val isSuccess: Boolean,
    val error: String? = null
) {
    val isEmpty: Boolean get() = rawText.isBlank()
    companion object {
        fun failure(message: String): OcrResult = OcrResult(
            rawText = "", cleanText = "", blocks = emptyList(),
            confidence = 0f, isSuccess = false, error = message
        )
        fun empty(): OcrResult = OcrResult(
            rawText = "", cleanText = "", blocks = emptyList(),
            confidence = 0f, isSuccess = true
        )
    }
}

/** Raw response from any AI provider. */
data class AIResponse(
    val text: String,
    val isSuccess: Boolean,
    val error: String? = null,
    val provider: String = "",
    val tokensUsed: Int = 0
) {
    companion object {
        fun failure(provider: String, message: String): AIResponse =
            AIResponse(text = "", isSuccess = false, error = message, provider = provider)
    }
}

/** Structured note parsed from an AI JSON response. */
data class ParsedNote(
    val title: String,
    val bullets: List<String>,
    val summary: String
) {
    fun toMarkdown(): String = buildString {
        append("# ").append(title).append('\n')
        if (summary.isNotBlank()) append('\n').append(summary).append('\n')
        if (bullets.isNotEmpty()) {
            append('\n')
            bullets.forEach { append("- ").append(it).append('\n') }
        }
    }
}

/** State machine for the screenshot/voice → note pipeline. */
sealed class WorkflowState {
    data object Idle              : WorkflowState()
    data object Capturing         : WorkflowState()
    data object ExtractingText    : WorkflowState()
    data object AiProcessing      : WorkflowState()
    data object Saving            : WorkflowState()
    data class  Done(val note: Note)                          : WorkflowState()
    data class  Failed(val error: String, val step: String)   : WorkflowState()

    val isTerminal: Boolean get() = this is Done || this is Failed
}

enum class AiProviderKey(val key: String, val displayName: String) {
    NONE      ("none",      "None — local"),
    OPENAI    ("openai",    "OpenAI"),
    GEMINI    ("gemini",    "Google Gemini"),
    ANTHROPIC ("anthropic", "Anthropic"),
    GROQ      ("groq",      "Groq");

    companion object {
        fun from(raw: String?): AiProviderKey =
            values().firstOrNull { it.key == raw } ?: NONE
    }
}

enum class FloatingButtonSide(val key: String) {
    LEFT("left"), RIGHT("right");
    companion object {
        fun from(raw: String?): FloatingButtonSide =
            values().firstOrNull { it.key == raw } ?: RIGHT
    }
}

data class NexosSettings(
    val provider: AiProviderKey       = AiProviderKey.NONE,
    val autoSummarize: Boolean        = true,
    val autoSave: Boolean             = true,
    val showFloatingButton: Boolean   = true,
    val floatingSide: FloatingButtonSide = FloatingButtonSide.RIGHT
)
