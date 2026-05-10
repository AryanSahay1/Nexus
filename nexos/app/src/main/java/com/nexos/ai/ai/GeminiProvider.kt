package com.nexos.ai.ai

import android.util.Log
import com.nexos.ai.data.remote.api.GeminiApi
import com.nexos.ai.data.remote.dto.GeminiContent
import com.nexos.ai.data.remote.dto.GeminiGenerationConfig
import com.nexos.ai.data.remote.dto.GeminiPart
import com.nexos.ai.data.remote.dto.GeminiRequest
import com.nexos.ai.data.secure.SecureStorage
import com.nexos.ai.domain.model.AIResponse
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GeminiProvider @Inject constructor(
    private val api: GeminiApi,
    private val secureStorage: SecureStorage,
) : AIProvider {
    override val name = "Gemini"
    override val providerKey = "gemini"

    fun hasKey(): Boolean = !secureStorage.getApiKey(providerKey).isNullOrBlank()

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse {
        val key = secureStorage.getApiKey(providerKey)
            ?: return AIResponse("", false, "Missing Gemini API key", providerKey)
        return try {
            val response = withTimeout(REQUEST_TIMEOUT_MS) {
                api.generate(
                    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                    apiKey = key,
                    body = GeminiRequest(
                        contents = listOf(GeminiContent(parts = listOf(GeminiPart(prompt)))),
                        generationConfig = GeminiGenerationConfig(maxOutputTokens = maxTokens),
                    ),
                )
            }
            val text = response.candidates.firstOrNull()?.content?.parts?.joinToString("\n") { it.text }.orEmpty()
            AIResponse(
                text = text,
                isSuccess = text.isNotBlank(),
                provider = providerKey,
                error = if (text.isBlank()) "Empty response" else null,
            )
        } catch (e: TimeoutCancellationException) {
            AIResponse("", false, "Request timed out", providerKey)
        } catch (e: IOException) {
            AIResponse("", false, "Network error: ${e.message}", providerKey)
        } catch (t: Throwable) {
            Log.e(TAG, "Gemini call failed", t)
            AIResponse("", false, t.message ?: "Unknown error", providerKey)
        }
    }

    override suspend fun testConnection(): Boolean = complete("ping", 8).isSuccess

    private companion object {
        const val TAG = "NexOS/GeminiProvider"
        const val REQUEST_TIMEOUT_MS = 30_000L
    }
}
