package com.nexos.ai.data.remote.api

import com.nexos.ai.data.remote.dto.AnthropicRequest
import com.nexos.ai.data.remote.dto.AnthropicResponse
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Url

interface AnthropicApi {
    @POST
    suspend fun messages(
        @Url url: String,
        @Header("x-api-key") apiKey: String,
        @Header("anthropic-version") version: String,
        @Body body: AnthropicRequest,
    ): AnthropicResponse
}
