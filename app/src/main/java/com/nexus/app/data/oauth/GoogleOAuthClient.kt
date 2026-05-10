package com.nexus.app.data.oauth

import android.content.Context
import android.content.Intent
import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.data.secure.OAuthBundle
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues
import net.openid.appauth.TokenResponse

/**
 * Google PKCE OAuth using AppAuth-Android.
 *
 * The user's own Client ID is read from preferences/secure store. Tokens are
 * persisted to the encrypted TokenStore (LAW 1, LAW 5) — only individual
 * strings, never raw response JSON.
 */
@Singleton
class GoogleOAuthClient @Inject constructor(
    @ApplicationContext private val context: Context,
    private val tokenStore: TokenStore
) {

    private val serviceConfig = AuthorizationServiceConfiguration(
        android.net.Uri.parse("https://accounts.google.com/o/oauth2/v2/auth"),
        android.net.Uri.parse("https://oauth2.googleapis.com/token")
    )

    private val redirectUri = android.net.Uri.parse("com.nexus.app:/oauth2redirect/google")

    fun buildAuthIntent(clientId: String): Intent {
        val request = AuthorizationRequest.Builder(
            serviceConfig,
            clientId,
            ResponseTypeValues.CODE,
            redirectUri
        ).setScopes(
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar"
        ).setAdditionalParameters(mapOf(
            "access_type" to "offline",
            "prompt" to "consent"
        )).build()
        val service = AuthorizationService(context)
        return service.getAuthorizationRequestIntent(request)
    }

    suspend fun handleAuthResponse(data: Intent, clientId: String): NexusResult<OAuthBundle> {
        val response = AuthorizationResponse.fromIntent(data)
        val ex = AuthorizationException.fromIntent(data)
        if (response == null) {
            return NexusResult.err(
                NexusError(NexusErrorCode.OAUTH_ERROR, ex?.errorDescription ?: "Authorization cancelled.")
            )
        }
        return exchangeCode(response, clientId)
    }

    private suspend fun exchangeCode(response: AuthorizationResponse, clientId: String): NexusResult<OAuthBundle> {
        val service = AuthorizationService(context)
        val tokenResp: TokenResponse? = suspendCancellableCoroutine { cont ->
            service.performTokenRequest(response.createTokenExchangeRequest()) { resp, ex ->
                if (ex != null) {
                    cont.resume(null)
                } else {
                    cont.resume(resp)
                }
            }
            cont.invokeOnCancellation { service.dispose() }
        }
        if (tokenResp == null || tokenResp.accessToken == null) {
            return NexusResult.err(
                NexusError(NexusErrorCode.OAUTH_ERROR, "Token exchange failed.")
            )
        }
        val email = decodeEmailFromIdToken(tokenResp.idToken)
        val bundle = OAuthBundle(
            accessToken = tokenResp.accessToken!!,
            refreshToken = tokenResp.refreshToken,
            idToken = tokenResp.idToken,
            userEmail = email,
            expiresAtEpochMs = tokenResp.accessTokenExpirationTime
        )
        return tokenStore.setOAuthBundle(Provider.Google, bundle).map { bundle }
    }

    fun disconnect(): NexusResult<Unit> = tokenStore.deleteAll(Provider.Google)

    private fun decodeEmailFromIdToken(idToken: String?): String? {
        if (idToken.isNullOrBlank()) return null
        val parts = idToken.split('.')
        if (parts.size < 2) return null
        return runCatching {
            val payload = android.util.Base64.decode(
                parts[1].padEnd((parts[1].length + 3) / 4 * 4, '='),
                android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP
            ).toString(Charsets.UTF_8)
            Regex("\"email\"\\s*:\\s*\"([^\"]+)\"").find(payload)?.groupValues?.getOrNull(1)
        }.getOrNull()
    }
}
