package com.nexos.ai.data.remote.dto

import com.google.gson.annotations.SerializedName

data class AnthropicRequest(
    val model: String,
    val messages: List<AnthropicMessage>,
    @SerializedName("max_tokens") val maxTokens: Int = 800,
    val temperature: Double? = 0.2
)

data class AnthropicMessage(
    val role: String,         // "user"
    val content: String
)

data class AnthropicResponse(
    val id: String?,
    val type: String?,
    val role: String?,
    val content: List<AnthropicContentBlock>?,
    val usage: AnthropicUsage?
)

data class AnthropicContentBlock(
    val type: String?,
    val text: String?
)

data class AnthropicUsage(
    @SerializedName("input_tokens")  val inputTokens: Int?,
    @SerializedName("output_tokens") val outputTokens: Int?
)
