package com.nexos.ai.ai

import android.util.Log
import com.nexos.ai.data.remote.api.GroqApi
import com.nexos.ai.data.remote.dto.OpenAiChatRequest
import com.nexos.ai.data.remote.dto.OpenAiMessage
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
class GroqProvider @Inject constructor(
    private val api: GroqApi,
    private val settings: SettingsRepository
) : AIProvider {

    override val name        = "Groq"
    override val providerKey = AiProviderKey.GROQ.key

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse {
        val key = settings.apiKeyFor(AiProviderKey.GROQ)
            ?: return AIResponse.failure(providerKey, "Groq key not set")
        return runSafely {
            val request = OpenAiChatRequest(
                model    = GroqApi.DEFAULT_MODEL,
                messages = listOf(OpenAiMessage(role = "user", content = prompt)),
                maxTokens = maxTokens,
                temperature = 0.2
            )
            val response = api.chat("Bearer $key", request)
            val body = response.body()
            if (!response.isSuccessful || body == null) {
                return@runSafely AIResponse.failure(providerKey, "Groq ${response.code()}")
            }
            val text = body.choices?.firstOrNull()?.message?.content.orEmpty()
            AIResponse(
                text       = text,
                isSuccess  = text.isNotBlank(),
                error      = if (text.isBlank()) "Empty response" else null,
                provider   = providerKey,
                tokensUsed = body.usage?.totalTokens ?: 0
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

    private companion object { const val TAG = "NexOS/GroqProvider" }
}
