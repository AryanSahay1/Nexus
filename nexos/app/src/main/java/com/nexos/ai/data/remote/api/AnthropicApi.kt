package com.nexos.ai.data.remote.api

import com.nexos.ai.data.remote.dto.AnthropicRequest
import com.nexos.ai.data.remote.dto.AnthropicResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface AnthropicApi {
    @POST("v1/messages")
    suspend fun message(
        @Header("x-api-key") apiKey: String,
        @Header("anthropic-version") version: String = "2023-06-01",
        @Body body: AnthropicRequest
    ): Response<AnthropicResponse>

    companion object {
        const val BASE_URL = "https://api.anthropic.com/"
        const val DEFAULT_MODEL = "claude-haiku-4-5-20251001"
    }
}
