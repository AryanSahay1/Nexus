package com.nexus.app.core

import java.io.IOException

enum class NexusErrorCode {
    UNKNOWN,
    NETWORK,
    TIMEOUT,
    UNAUTHORIZED,
    FORBIDDEN,
    NOT_FOUND,
    RATE_LIMIT,
    INVALID_PARAMETER,
    PROVIDER_ERROR,
    SECURE_STORE_ERROR,
    DATABASE_ERROR,
    OAUTH_ERROR,
    SESSION_EXPIRED,
    USER_CANCELLED,
    PERMISSION_DENIED,
    AGENT_ITERATION_CAP
}

data class NexusError(
    val code: NexusErrorCode,
    override val message: String,
    val isRetryable: Boolean = false,
    val rootCause: Throwable? = null
) : RuntimeException(message, rootCause) {
    companion object {
        fun fromThrowable(t: Throwable, fallback: NexusErrorCode = NexusErrorCode.UNKNOWN): NexusError {
            if (t is NexusError) return t
            val code = when (t) {
                is IOException -> NexusErrorCode.NETWORK
                else -> fallback
            }
            return NexusError(
                code = code,
                message = t.message ?: t::class.java.simpleName,
                isRetryable = code == NexusErrorCode.NETWORK || code == NexusErrorCode.TIMEOUT,
                rootCause = t
            )
        }
    }
}
