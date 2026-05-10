package com.nexos.ai.data.remote.dto

import com.google.gson.annotations.SerializedName

data class OpenAiChatRequest(
    val model: String,
    val messages: List<OpenAiMessage>,
    @SerializedName("max_tokens") val maxTokens: Int = 800,
    val temperature: Double = 0.4,
)

data class OpenAiMessage(
    val role: String,
    val content: String,
)

data class OpenAiChatResponse(
    val choices: List<OpenAiChoice> = emptyList(),
    val usage: OpenAiUsage? = null,
)

data class OpenAiChoice(
    val index: Int = 0,
    val message: OpenAiMessage? = null,
)

data class OpenAiUsage(
    @SerializedName("total_tokens") val totalTokens: Int = 0,
)
