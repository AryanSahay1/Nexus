package com.nexos.ai.ai

import android.util.Log
import com.nexos.ai.data.remote.api.AnthropicApi
import com.nexos.ai.data.remote.dto.AnthropicMessage
import com.nexos.ai.data.remote.dto.AnthropicRequest
import com.nexos.ai.data.secure.SecureStorage
import com.nexos.ai.domain.model.AIResponse
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnthropicProvider @Inject constructor(
    private val api: AnthropicApi,
    private val secureStorage: SecureStorage,
) : AIProvider {
    override val name = "Anthropic"
    override val providerKey = "anthropic"

    fun hasKey(): Boolean = !secureStorage.getApiKey(providerKey).isNullOrBlank()

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse {
        val key = secureStorage.getApiKey(providerKey)
            ?: return AIResponse("", false, "Missing Anthropic API key", providerKey)
        return try {
            val response = withTimeout(REQUEST_TIMEOUT_MS) {
                api.messages(
                    url = "https://api.anthropic.com/v1/messages",
                    apiKey = key,
                    version = "2023-06-01",
                    body = AnthropicRequest(
                        model = "claude-haiku-4-5-20251001",
                        maxTokens = maxTokens,
                        messages = listOf(AnthropicMessage("user", prompt)),
                    ),
                )
            }
            val text = response.content.firstOrNull { it.type == "text" }?.text.orEmpty()
            AIResponse(
                text = text,
                isSuccess = text.isNotBlank(),
                provider = providerKey,
                tokensUsed = (response.usage?.inputTokens ?: 0) + (response.usage?.outputTokens ?: 0),
                error = if (text.isBlank()) "Empty response" else null,
            )
        } catch (e: TimeoutCancellationException) {
            AIResponse("", false, "Request timed out", providerKey)
        } catch (e: IOException) {
            AIResponse("", false, "Network error: ${e.message}", providerKey)
        } catch (t: Throwable) {
            Log.e(TAG, "Anthropic call failed", t)
            AIResponse("", false, t.message ?: "Unknown error", providerKey)
        }
    }

    override suspend fun testConnection(): Boolean = complete("ping", 8).isSuccess

    private companion object {
        const val TAG = "NexOS/AnthropicProvider"
        const val REQUEST_TIMEOUT_MS = 30_000L
    }
}
