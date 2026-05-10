package com.nexus.app.data.network

import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor that injects the Google access token from `TokenStore`
 * onto outbound requests when present. The OpenAI request includes its key
 * directly via the service interface (so the key stays explicit per call).
 */
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        if (original.header(SKIP_AUTH) != null) {
            return chain.proceed(original.newBuilder().removeHeader(SKIP_AUTH).build())
        }
        val token = tokenStore.get(Provider.Google, TokenType.AccessToken).getOrNull()
        return if (token.isNullOrBlank()) chain.proceed(original)
        else chain.proceed(original.newBuilder().header("Authorization", "Bearer $token").build())
    }

    companion object {
        const val SKIP_AUTH = "X-Nexus-Skip-Auth"
    }
}
