package com.nexus.app.core

import android.util.Log

/**
 * Privacy-safe structured logger.
 *
 * LAW 2: never log API keys, tokens, message content, phone numbers, or PII.
 * The allowlist below is intentionally tiny — anything not on it is dropped.
 */
object NexusLog {

    private const val TAG = "Nexus"

    private val SAFE_KEYS = setOf(
        "step", "tool", "tool_name", "provider", "iteration",
        "duration_ms", "latency_ms", "error_code", "is_retryable",
        "destination", "status", "tab", "screen", "event"
    )

    private val PII_PATTERNS = listOf(
        Regex("""sk-[A-Za-z0-9]{20,}"""),                       // OpenAI keys
        Regex("""ya29\.[A-Za-z0-9\-_]+"""),                     // Google access tokens
        Regex("""1//[A-Za-z0-9\-_]+"""),                        // Google refresh tokens
        Regex("""[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"""), // emails
        Regex("""\+?\d[\d \-]{6,}\d""")                         // phone numbers
    )

    fun d(event: String, fields: Map<String, Any?> = emptyMap()) =
        write(Log.DEBUG, event, fields)

    fun i(event: String, fields: Map<String, Any?> = emptyMap()) =
        write(Log.INFO, event, fields)

    fun w(event: String, fields: Map<String, Any?> = emptyMap()) =
        write(Log.WARN, event, fields)

    fun e(event: String, fields: Map<String, Any?> = emptyMap(), throwable: Throwable? = null) {
        write(Log.ERROR, event, fields)
        if (throwable != null) {
            Log.e(TAG, "exception in $event: ${scrub(throwable.message ?: "")}")
        }
    }

    private fun write(level: Int, event: String, fields: Map<String, Any?>) {
        val safe = fields
            .filterKeys { it in SAFE_KEYS }
            .mapValues { (_, v) -> scrub(v?.toString() ?: "null") }
        val line = if (safe.isEmpty()) event else "$event ${safe.entries.joinToString(" ") { "${it.key}=${it.value}" }}"
        when (level) {
            Log.DEBUG -> Log.d(TAG, line)
            Log.INFO -> Log.i(TAG, line)
            Log.WARN -> Log.w(TAG, line)
            Log.ERROR -> Log.e(TAG, line)
        }
    }

    internal fun scrub(input: String): String {
        var out = input
        for (p in PII_PATTERNS) out = out.replace(p, "<redacted>")
        return out
    }
}
