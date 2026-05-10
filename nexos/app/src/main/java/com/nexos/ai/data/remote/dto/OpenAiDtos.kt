package com.nexos.ai.data.remote.dto

import com.google.gson.annotations.SerializedName

/* OpenAI-compatible (also used by Groq). */

data class OpenAiChatRequest(
    val model: String,
    val messages: List<OpenAiMessage>,
    @SerializedName("max_tokens") val maxTokens: Int? = null,
    val temperature: Double? = 0.2
)

data class OpenAiMessage(
    val role: String,        // "user" | "system" | "assistant"
    val content: String
)

data class OpenAiChatResponse(
    val choices: List<OpenAiChoice>?,
    val usage: OpenAiUsage?
)

data class OpenAiChoice(
    val index: Int?,
    val message: OpenAiMessage?,
    @SerializedName("finish_reason") val finishReason: String?
)

data class OpenAiUsage(
    @SerializedName("prompt_tokens")     val promptTokens: Int?,
    @SerializedName("completion_tokens") val completionTokens: Int?,
    @SerializedName("total_tokens")      val totalTokens: Int?
)
