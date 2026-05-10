package com.nexos.ai.ai

import android.util.Log
import com.nexos.ai.data.remote.api.GeminiApi
import com.nexos.ai.data.remote.dto.GeminiContent
import com.nexos.ai.data.remote.dto.GeminiGenerationConfig
import com.nexos.ai.data.remote.dto.GeminiPart
import com.nexos.ai.data.remote.dto.GeminiRequest
import com.nexos.ai.data.repository.SettingsRepository
import com.nexos.ai.domain.model.AIResponse
import com.nexos.ai.domain.model.AiProviderKey
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GeminiProvider @Inject constructor(
    private val api: GeminiApi,
    private val settings: SettingsRepository
) : AIProvider {

    override val name        = "Gemini"
    override val providerKey = AiProviderKey.GEMINI.key

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse {
        val key = settings.apiKeyFor(AiProviderKey.GEMINI)
            ?: return AIResponse.failure(providerKey, "Gemini key not set")
        return runSafely {
            val request = GeminiRequest(
                contents = listOf(GeminiContent(parts = listOf(GeminiPart(prompt)))),
                generationConfig = GeminiGenerationConfig(
                    temperature = 0.2, maxOutputTokens = maxTokens
                )
            )
            val response = api.generate(GeminiApi.DEFAULT_MODEL, key, request)
            val body = response.body()
            if (!response.isSuccessful || body == null) {
                return@runSafely AIResponse.failure(providerKey, "Gemini ${response.code()}")
            }
            val text = body.candidates
                ?.firstOrNull()
                ?.content?.parts
                ?.joinToString(separator = "") { it.text }
                .orEmpty()
            AIResponse(
                text      = text,
                isSuccess = text.isNotBlank(),
                error     = if (text.isBlank()) "Empty response" else null,
                provider  = providerKey
            )
        }
    }

    override suspend fun testConnection(): Boolean =
        complete("Reply with exactly: ok", maxTokens = 4).isSuccess

    private suspend fun runSafely(block: suspend () -> AIResponse): AIResponse = try {
        withTimeout(30_000L) { block() }
    } catch (e: TimeoutCancellationException) {
        AIResponse.failure(providerKey, "Request timed out")
    } catch (e: IOException) {
        Log.w(TAG, "Network error", e)
        AIResponse.failure(providerKey, "Network error: ${e.message ?: "unknown"}")
    } catch (e: HttpException) {
        AIResponse.failure(providerKey, "API error ${e.code()}")
    } catch (e: Exception) {
        Log.e(TAG, "Unexpected error", e)
        AIResponse.failure(providerKey, "Unexpected error")
    }

    private companion object { const val TAG = "NexOS/GeminiProvider" }
}
