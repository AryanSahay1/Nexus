package com.nexos.ai.data.remote.dto

import com.google.gson.annotations.SerializedName

data class AnthropicRequest(
    val model: String,
    @SerializedName("max_tokens") val maxTokens: Int = 800,
    val messages: List<AnthropicMessage>,
    val temperature: Double = 0.4,
)

data class AnthropicMessage(
    val role: String,
    val content: String,
)

data class AnthropicResponse(
    val content: List<AnthropicContentBlock> = emptyList(),
    val usage: AnthropicUsage? = null,
)

data class AnthropicContentBlock(
    val type: String = "text",
    val text: String = "",
)

data class AnthropicUsage(
    @SerializedName("input_tokens") val inputTokens: Int = 0,
    @SerializedName("output_tokens") val outputTokens: Int = 0,
)
