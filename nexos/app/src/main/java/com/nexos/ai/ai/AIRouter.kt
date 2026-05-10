package com.nexos.ai.ai

import com.nexos.ai.data.repository.SettingsRepository
import com.nexos.ai.domain.model.AIResponse
import com.nexos.ai.domain.model.AiProviderKey
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Selects the active [AIProvider] based on user settings and routes
 * `complete()` calls to it. Always falls back to [NoOpProvider] when
 * no key is configured for the selected provider.
 */
@Singleton
class AIRouter @Inject constructor(
    private val openAi:    OpenAIProvider,
    private val gemini:    GeminiProvider,
    private val anthropic: AnthropicProvider,
    private val groq:      GroqProvider,
    private val noOp:      NoOpProvider,
    private val settings:  SettingsRepository
) {

    suspend fun currentProvider(): AIProvider = when (settings.settings.first().provider) {
        AiProviderKey.NONE      -> noOp
        AiProviderKey.OPENAI    -> if (settings.apiKeyFor(AiProviderKey.OPENAI)    != null) openAi    else noOp
        AiProviderKey.GEMINI    -> if (settings.apiKeyFor(AiProviderKey.GEMINI)    != null) gemini    else noOp
        AiProviderKey.ANTHROPIC -> if (settings.apiKeyFor(AiProviderKey.ANTHROPIC) != null) anthropic else noOp
        AiProviderKey.GROQ      -> if (settings.apiKeyFor(AiProviderKey.GROQ)      != null) groq      else noOp
    }

    suspend fun isAiEnabled(): Boolean = currentProvider() !is NoOpProvider

    suspend fun complete(prompt: String, maxTokens: Int = 800): AIResponse =
        currentProvider().complete(prompt, maxTokens)

    suspend fun providerFor(key: AiProviderKey): AIProvider = when (key) {
        AiProviderKey.NONE      -> noOp
        AiProviderKey.OPENAI    -> openAi
        AiProviderKey.GEMINI    -> gemini
        AiProviderKey.ANTHROPIC -> anthropic
        AiProviderKey.GROQ      -> groq
    }
}
