package com.nexos.ai.data.remote.api

import com.nexos.ai.data.remote.dto.GeminiRequest
import com.nexos.ai.data.remote.dto.GeminiResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.http.Url

interface GeminiApi {
    @POST
    suspend fun generate(
        @Url url: String,
        @Query("key") apiKey: String,
        @Body body: GeminiRequest,
    ): GeminiResponse
}
