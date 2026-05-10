package com.nexus.app.data.service

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface OpenAiApiService {

    @POST("v1/chat/completions")
    suspend fun chatCompletions(
        @Header("Authorization") auth: String,
        @Body body: ChatCompletionRequest
    ): Response<ChatCompletionResponse>
}

@Serializable
data class ChatCompletionRequest(
    val model: String,
    val messages: List<ChatMessageDto>,
    val tools: List<ChatToolDto>? = null,
    @SerialName("tool_choice") val toolChoice: String? = null,
    val temperature: Double? = null,
    val stream: Boolean? = null
)

@Serializable
data class ChatMessageDto(
    val role: String,
    val content: String? = null,
    val name: String? = null,
    @SerialName("tool_call_id") val toolCallId: String? = null,
    @SerialName("tool_calls") val toolCalls: List<ChatToolCallDto>? = null
)

@Serializable
data class ChatToolDto(
    val type: String = "function",
    val function: ChatFunctionDto
)

@Serializable
data class ChatFunctionDto(
    val name: String,
    val description: String,
    val parameters: JsonElement
)

@Serializable
data class ChatToolCallDto(
    val id: String,
    val type: String = "function",
    val function: ChatToolCallFunctionDto
)

@Serializable
data class ChatToolCallFunctionDto(
    val name: String,
    val arguments: String
)

@Serializable
data class ChatCompletionResponse(
    val id: String,
    val choices: List<ChatCompletionChoice>
)

@Serializable
data class ChatCompletionChoice(
    val index: Int,
    val message: ChatMessageDto,
    @SerialName("finish_reason") val finishReason: String? = null
)
