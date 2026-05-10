package com.nexos.ai.ai

import android.util.Log
import com.nexos.ai.data.remote.api.OpenAiApi
import com.nexos.ai.data.remote.dto.OpenAiChatRequest
import com.nexos.ai.data.remote.dto.OpenAiMessage
import com.nexos.ai.data.secure.SecureStorage
import com.nexos.ai.domain.model.AIResponse
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Groq exposes the same wire format as OpenAI; we reuse the OpenAi-style API.
 */
@Singleton
class GroqProvider @Inject constructor(
    private val api: OpenAiApi,
    private val secureStorage: SecureStorage,
) : AIProvider {
    override val name = "Groq"
    override val providerKey = "groq"

    fun hasKey(): Boolean = !secureStorage.getApiKey(providerKey).isNullOrBlank()

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse {
        val key = secureStorage.getApiKey(providerKey)
            ?: return AIResponse("", false, "Missing Groq API key", providerKey)
        return try {
            val response = withTimeout(REQUEST_TIMEOUT_MS) {
                api.chat(
                    url = "https://api.groq.com/openai/v1/chat/completions",
                    auth = "Bearer $key",
                    body = OpenAiChatRequest(
                        model = "llama3-8b-8192",
                        messages = listOf(OpenAiMessage("user", prompt)),
                        maxTokens = maxTokens,
                    ),
                )
            }
            val text = response.choices.firstOrNull()?.message?.content.orEmpty()
            AIResponse(
                text = text,
                isSuccess = text.isNotBlank(),
                provider = providerKey,
                tokensUsed = response.usage?.totalTokens ?: 0,
                error = if (text.isBlank()) "Empty response" else null,
            )
        } catch (e: TimeoutCancellationException) {
            AIResponse("", false, "Request timed out", providerKey)
        } catch (e: IOException) {
            AIResponse("", false, "Network error: ${e.message}", providerKey)
        } catch (t: Throwable) {
            Log.e(TAG, "Groq call failed", t)
            AIResponse("", false, t.message ?: "Unknown error", providerKey)
        }
    }

    override suspend fun testConnection(): Boolean = complete("ping", 8).isSuccess

    private companion object {
        const val TAG = "NexOS/GroqProvider"
        const val REQUEST_TIMEOUT_MS = 30_000L
    }
}
