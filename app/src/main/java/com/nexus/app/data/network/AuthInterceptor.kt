package com.nexus.app.data.network

import com.nexus.app.core.NexusLog
import com.nexus.app.core.NexusResult
import com.nexus.app.data.oauth.GoogleTokenRefresher
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import java.util.concurrent.locks.ReentrantLock
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.concurrent.withLock
import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor that injects the Google access token from `TokenStore`
 * onto outbound requests when present. On a 401 it performs a single-flight
 * refresh against Google's token endpoint and replays the original request
 * exactly once with the new bearer (B-31).
 *
 * `Provider.OpenAI` requests carry their own `Authorization` header set by
 * `OpenAiService` and are skipped via the [SKIP_AUTH] header.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
    private val refresher: GoogleTokenRefresher
) : Interceptor {

    private val refreshLock = ReentrantLock()

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        if (original.header(SKIP_AUTH) != null) {
            return chain.proceed(original.newBuilder().removeHeader(SKIP_AUTH).build())
        }

        val token = tokenStore.get(Provider.Google, TokenType.AccessToken).getOrNull()
        val first = if (token.isNullOrBlank()) chain.proceed(original)
        else chain.proceed(original.newBuilder().header("Authorization", "Bearer $token").build())

        if (first.code != 401) return first

        first.close()
        val newToken = refreshLock.withLock {
            // Double-check inside the lock: another thread may have refreshed
            // while we were waiting.
            val current = tokenStore.get(Provider.Google, TokenType.AccessToken).getOrNull()
            if (!current.isNullOrBlank() && current != token) current
            else when (val r = refresher.refresh()) {
                is NexusResult.Ok -> r.value
                is NexusResult.Err -> {
                    NexusLog.w("google_auth_refresh_giveup", mapOf("error_code" to r.error.code.name))
                    null
                }
            }
        } ?: return first.replayUnauthorized(chain, original)

        return chain.proceed(original.newBuilder().header("Authorization", "Bearer $newToken").build())
    }

    /**
     * If the refresh failed we still need to surface SOMETHING to Retrofit.
     * Replay the original request unauthenticated so the call site receives
     * a real 401 it can map to `SESSION_EXPIRED` rather than dangling with a
     * closed body.
     */
    private fun Response.replayUnauthorized(chain: Interceptor.Chain, original: okhttp3.Request): Response =
        chain.proceed(original.newBuilder().removeHeader("Authorization").build())

    companion object {
        const val SKIP_AUTH = "X-Nexus-Skip-Auth"
    }
}
