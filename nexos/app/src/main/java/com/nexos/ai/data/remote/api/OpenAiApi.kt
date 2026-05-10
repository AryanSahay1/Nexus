package com.nexos.ai.data.remote.api

import com.nexos.ai.data.remote.dto.OpenAiChatRequest
import com.nexos.ai.data.remote.dto.OpenAiChatResponse
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Url

interface OpenAiApi {
    @POST
    suspend fun chat(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: OpenAiChatRequest,
    ): OpenAiChatResponse
}
