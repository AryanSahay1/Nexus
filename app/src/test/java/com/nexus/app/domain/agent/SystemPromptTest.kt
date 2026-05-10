package com.nexus.app.domain.agent

import com.google.common.truth.Truth.assertThat
import java.util.Date
import java.util.TimeZone
import org.junit.Test

class SystemPromptTest {

    private val tz = TimeZone.getTimeZone("UTC")
    private val now = Date(1_700_000_000_000L)

    @Test fun `prompt contains current time and persona`() {
        val out = SystemPromptBuilder.build(
            preferences = emptyMap(),
            connectedProviders = emptySet(),
            timeZone = tz,
            now = now
        )
        assertThat(out).contains("Nexus")
        assertThat(out).contains("Current time:")
        assertThat(out).contains("Connected Services:")
        assertThat(out).contains("RULES")
    }

    @Test fun `preferences are listed verbatim`() {
        val out = SystemPromptBuilder.build(
            preferences = mapOf("email_tone" to "professional", "wife_phone" to "+91"),
            connectedProviders = setOf("google"),
            timeZone = tz,
            now = now
        )
        assertThat(out).contains("- email_tone: professional")
        assertThat(out).contains("- wife_phone: +91")
        assertThat(out).contains("google")
    }

    @Test fun `empty preferences renders 'none'`() {
        val out = SystemPromptBuilder.build(emptyMap(), emptySet(), tz, now)
        assertThat(out).contains("(none)")
    }
}
