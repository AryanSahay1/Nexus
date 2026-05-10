package com.nexos.ai.ai

import android.util.Log
import com.nexos.ai.data.remote.api.AnthropicApi
import com.nexos.ai.data.remote.dto.AnthropicMessage
import com.nexos.ai.data.remote.dto.AnthropicRequest
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
class AnthropicProvider @Inject constructor(
    private val api: AnthropicApi,
    private val settings: SettingsRepository
) : AIProvider {

    override val name        = "Anthropic"
    override val providerKey = AiProviderKey.ANTHROPIC.key

    override suspend fun complete(prompt: String, maxTokens: Int): AIResponse {
        val key = settings.apiKeyFor(AiProviderKey.ANTHROPIC)
            ?: return AIResponse.failure(providerKey, "Anthropic key not set")
        return runSafely {
            val request = AnthropicRequest(
                model    = AnthropicApi.DEFAULT_MODEL,
                messages = listOf(AnthropicMessage(role = "user", content = prompt)),
                maxTokens = maxTokens,
                temperature = 0.2
            )
            val response = api.message(apiKey = key, body = request)
            val body = response.body()
            if (!response.isSuccessful || body == null) {
                return@runSafely AIResponse.failure(providerKey, "Anthropic ${response.code()}")
            }
            val text = body.content
                ?.filter { it.type == "text" }
                ?.joinToString(separator = "") { it.text.orEmpty() }
                .orEmpty()
            val tokens = (body.usage?.inputTokens ?: 0) + (body.usage?.outputTokens ?: 0)
            AIResponse(
                text       = text,
                isSuccess  = text.isNotBlank(),
                error      = if (text.isBlank()) "Empty response" else null,
                provider   = providerKey,
                tokensUsed = tokens
            )
        }
    }

    override suspend fun testConnection(): Boolean =
        complete("Reply with exactly: ok", maxTokens = 8).isSuccess

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

    private companion object { const val TAG = "NexOS/AnthropicProvider" }
}
