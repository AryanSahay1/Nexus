package com.nexos.ai.ai

import com.nexos.ai.domain.model.AIResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoOpProvider @Inject constructor() : AIProvider {
    override val name = "None"
    override val providerKey = "none"

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse =
        AIResponse(text = "", isSuccess = false, error = "No AI provider configured")

    override suspend fun testConnection(): Boolean = false
}
