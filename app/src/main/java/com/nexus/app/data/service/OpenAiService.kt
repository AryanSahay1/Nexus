package com.nexus.app.data.service

import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import javax.inject.Inject
import javax.inject.Singleton
import retrofit2.HttpException

/**
 * Thin wrapper around the OpenAI Retrofit interface that:
 *  - reads the API key from the encrypted TokenStore on every call
 *  - maps HTTP responses to `NexusResult<T, NexusError>`
 *  - never logs request/response bodies (LAW 2)
 */
@Singleton
class OpenAiService @Inject constructor(
    private val api: OpenAiApiService,
    private val tokenStore: TokenStore
) {

    suspend fun chatCompletion(
        request: ChatCompletionRequest
    ): NexusResult<ChatCompletionResponse> {
        val key = tokenStore.get(Provider.OpenAI, TokenType.ApiKey).getOrNull()
        if (key.isNullOrBlank()) {
            return NexusResult.err(
                NexusError(
                    code = NexusErrorCode.UNAUTHORIZED,
                    message = "OpenAI API key is not configured. Add it under Vault > OpenAI."
                )
            )
        }
        return try {
            val response = api.chatCompletions(auth = "Bearer $key", body = request)
            if (response.isSuccessful) {
                val body = response.body()
                    ?: return NexusResult.err(
                        NexusError(
                            code = NexusErrorCode.PROVIDER_ERROR,
                            message = "OpenAI returned an empty body."
                        )
                    )
                NexusResult.ok(body)
            } else {
                NexusResult.err(mapHttp(response.code(), response.message()))
            }
        } catch (e: HttpException) {
            NexusResult.err(mapHttp(e.code(), e.message()))
        } catch (e: Throwable) {
            NexusResult.err(NexusError.fromThrowable(e, NexusErrorCode.NETWORK))
        }
    }

    private fun mapHttp(code: Int, message: String?): NexusError {
        val (errCode, retryable) = when (code) {
            401 -> NexusErrorCode.UNAUTHORIZED to false
            403 -> NexusErrorCode.FORBIDDEN to false
            404 -> NexusErrorCode.NOT_FOUND to false
            408 -> NexusErrorCode.TIMEOUT to true
            429 -> NexusErrorCode.RATE_LIMIT to true
            in 500..599 -> NexusErrorCode.PROVIDER_ERROR to true
            else -> NexusErrorCode.PROVIDER_ERROR to false
        }
        return NexusError(
            code = errCode,
            message = "OpenAI HTTP $code${if (message.isNullOrBlank()) "" else ": $message"}",
            isRetryable = retryable
        )
    }
}
