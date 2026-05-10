package com.nexos.ai.ai

import com.nexos.ai.domain.model.AIResponse

interface AIProvider {
    val name: String
    val providerKey: String

    suspend fun complete(prompt: String, maxTokens: Int = 800): AIResponse
    suspend fun testConnection(): Boolean
}
