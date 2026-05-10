package com.nexos.ai.ai

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Picks the active AIProvider based on the user's saved settings + key availability.
 *
 * Falls back to NoOpProvider when:
 *   - User selected "none"
 *   - User selected a provider but no API key is stored for it
 */
@Singleton
class AIRouter @Inject constructor(
    private val noOp: NoOpProvider,
    private val openAi: OpenAIProvider,
    private val gemini: GeminiProvider,
    private val anthropic: AnthropicProvider,
    private val groq: GroqProvider,
) {
    fun isEnabled(providerKey: String): Boolean = pick(providerKey) !is NoOpProvider

    fun pick(providerKey: String): AIProvider = when (providerKey) {
        "openai" -> if (openAi.hasKey()) openAi else noOp
        "gemini" -> if (gemini.hasKey()) gemini else noOp
        "anthropic" -> if (anthropic.hasKey()) anthropic else noOp
        "groq" -> if (groq.hasKey()) groq else noOp
        else -> noOp
    }
}
