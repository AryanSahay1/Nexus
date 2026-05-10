package com.nexos.ai.data.remote.api

import com.nexos.ai.data.remote.dto.GeminiRequest
import com.nexos.ai.data.remote.dto.GeminiResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface GeminiApi {
    @POST("v1beta/models/{model}:generateContent")
    suspend fun generate(
        @Path("model") model: String,
        @Query("key")  apiKey: String,
        @Body body: GeminiRequest
    ): Response<GeminiResponse>

    companion object {
        const val BASE_URL = "https://generativelanguage.googleapis.com/"
        const val DEFAULT_MODEL = "gemini-1.5-flash"
    }
}
