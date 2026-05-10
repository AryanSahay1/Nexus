package com.nexus.app.data.oauth

import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusLog
import com.nexus.app.core.NexusResult
import com.nexus.app.core.runCatchingNexus
import com.nexus.app.data.network.nexusJson
import com.nexus.app.data.secure.OAuthBundle
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Refreshes Google OAuth access tokens against `https://oauth2.googleapis.com/token`.
 *
 * Reads the refresh token + client id from the encrypted store, calls the
 * `refresh_token` grant, and writes the new access token back atomically.
 * Used by `AuthInterceptor` to recover from 401 responses without bothering
 * the user (B-31).
 *
 * Uses a *raw* OkHttpClient (no AuthInterceptor) to avoid an infinite recursion
 * when the refresh request itself would otherwise fire the same interceptor.
 */
@Singleton
class GoogleTokenRefresher @Inject constructor(
    private val tokenStore: TokenStore
) {

    private val rawClient = OkHttpClient.Builder().build()

    fun refresh(): NexusResult<String> {
        val refreshToken = tokenStore.get(Provider.Google, TokenType.RefreshToken).getOrNull()
        val clientId = tokenStore.get(Provider.Google, TokenType.ClientId).getOrNull()
        if (refreshToken.isNullOrBlank() || clientId.isNullOrBlank()) {
            return NexusResult.err(
                NexusError(
                    code = NexusErrorCode.SESSION_EXPIRED,
                    message = "Google session expired. Reconnect Google in Vault."
                )
            )
        }

        val body = FormBody.Builder()
            .add("grant_type", "refresh_token")
            .add("refresh_token", refreshToken)
            .add("client_id", clientId)
            .build()
        val request = Request.Builder()
            .url("https://oauth2.googleapis.com/token")
            .post(body)
            .build()

        return runCatchingNexus(NexusErrorCode.NETWORK) {
            rawClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    NexusLog.w(
                        "google_refresh_failed",
                        mapOf("status" to response.code, "provider" to "google")
                    )
                    throw NexusError(
                        code = if (response.code == 400 || response.code == 401) NexusErrorCode.SESSION_EXPIRED
                        else NexusErrorCode.PROVIDER_ERROR,
                        message = "Google refresh returned HTTP ${response.code}",
                        isRetryable = false
                    )
                }
                val payloadText = response.body?.string().orEmpty()
                val payload = nexusJson.decodeFromString(GoogleRefreshResponse.serializer(), payloadText)
                val newAccess = payload.accessToken
                    ?: throw NexusError(NexusErrorCode.PROVIDER_ERROR, "Refresh response missing access_token")

                tokenStore.setOAuthBundle(
                    Provider.Google,
                    OAuthBundle(
                        accessToken = newAccess,
                        // Google omits refresh_token in the refresh response —
                        // keep the existing one.
                        refreshToken = refreshToken,
                        idToken = tokenStore.get(Provider.Google, TokenType.IdToken).getOrNull(),
                        userEmail = tokenStore.get(Provider.Google, TokenType.UserEmail).getOrNull(),
                        expiresAtEpochMs = payload.expiresIn?.let {
                            System.currentTimeMillis() + it * 1000L
                        }
                    )
                )
                newAccess
            }
        }
    }
}

@Serializable
private data class GoogleRefreshResponse(
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("expires_in") val expiresIn: Long? = null,
    @SerialName("token_type") val tokenType: String? = null
)
