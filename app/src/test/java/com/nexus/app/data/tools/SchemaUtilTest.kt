package com.nexus.app.data.tools

import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Test

/**
 * Regression tests for B-12: tool result JSON must be valid even when the
 * underlying field values contain quotes, newlines, backslashes, or other
 * characters that would have broken naive string concatenation.
 */
class SchemaUtilTest {

    @Test
    fun `toolJson escapes embedded quotes`() {
        val json = toolJson { put("subject", """Re: "urgent" — please reply""") }
        // The result must round-trip back through the parser.
        val parsed = parseSchema(json)
        assertThat(parsed.toString()).contains("Re: \\\"urgent\\\"")
    }

    @Test
    fun `toolJson escapes newlines and control chars`() {
        val json = toolJson { put("body", "line1\nline2\twith\ttabs") }
        // Should be valid JSON: parsing must not throw.
        parseSchema(json)
    }

    @Test
    fun `toolJsonArray emits a syntactically valid JSON array`() {
        val items = listOf(
            buildJsonObject { put("subject", "hello \"world\"") },
            buildJsonObject { put("subject", "second \\ entry") }
        )
        val out = toolJsonArray(items)
        assertThat(out).startsWith("[")
        assertThat(out).endsWith("]")
        // Round-trips through the parser.
        parseSchema(out)
    }

    @Test
    fun `parseArguments returns empty object on malformed input`() {
        val args = parseArguments("not-json")
        assertThat(args.entries).isEmpty()
    }
}
