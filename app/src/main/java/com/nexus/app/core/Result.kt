package com.nexus.app.core

/**
 * Discriminated-union result type used by every service and repository in Nexus.
 * Mirrors the original TypeScript `Result<T, NexusError>` contract from the React
 * Native build so the agent loop can always inspect a typed outcome instead of
 * catching raw exceptions.
 */
sealed class NexusResult<out T> {
    data class Ok<T>(val value: T) : NexusResult<T>()
    data class Err(val error: NexusError) : NexusResult<Nothing>()

    inline fun <R> map(transform: (T) -> R): NexusResult<R> = when (this) {
        is Ok -> Ok(transform(value))
        is Err -> this
    }

    inline fun <R> flatMap(transform: (T) -> NexusResult<R>): NexusResult<R> = when (this) {
        is Ok -> transform(value)
        is Err -> this
    }

    fun getOrNull(): T? = (this as? Ok)?.value
    fun errorOrNull(): NexusError? = (this as? Err)?.error
    val isOk: Boolean get() = this is Ok
    val isErr: Boolean get() = this is Err

    companion object {
        fun <T> ok(value: T): NexusResult<T> = Ok(value)
        fun err(error: NexusError): NexusResult<Nothing> = Err(error)
    }
}

inline fun <T> runCatchingNexus(
    code: NexusErrorCode = NexusErrorCode.UNKNOWN,
    block: () -> T
): NexusResult<T> = try {
    NexusResult.Ok(block())
} catch (t: Throwable) {
    NexusResult.Err(NexusError.fromThrowable(t, code))
}
