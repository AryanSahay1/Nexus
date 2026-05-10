package com.nexos.ai.data.remote.api

import com.nexos.ai.data.remote.dto.OpenAiChatRequest
import com.nexos.ai.data.remote.dto.OpenAiChatResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface OpenAiApi {
    @POST("v1/chat/completions")
    suspend fun chat(
        @Header("Authorization") authorization: String,
        @Body body: OpenAiChatRequest
    ): Response<OpenAiChatResponse>

    companion object {
        const val BASE_URL = "https://api.openai.com/"
        const val DEFAULT_MODEL = "gpt-4o-mini"
    }
}
