package com.nexus.app.data.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit

internal val nexusJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = true
    isLenient = true
}

private val jsonMediaType = "application/json".toMediaType()

fun openAiRetrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
    .baseUrl("https://api.openai.com/")
    .client(client)
    .addConverterFactory(nexusJson.asConverterFactory(jsonMediaType))
    .build()

fun googleRetrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
    .baseUrl("https://www.googleapis.com/")
    .client(client)
    .addConverterFactory(nexusJson.asConverterFactory(jsonMediaType))
    .build()
