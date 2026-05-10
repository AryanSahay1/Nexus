package com.nexus.app.core

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LoggerTest {

    @Test
    fun `scrub redacts OpenAI keys`() {
        val out = NexusLog.scrub("user said: sk-abcdefghijklmnopqrstu1234567890")
        assertThat(out).contains("<redacted>")
        assertThat(out).doesNotContain("sk-abcdefghij")
    }

    @Test
    fun `scrub redacts emails`() {
        val out = NexusLog.scrub("contact me at jane.doe@example.com please")
        assertThat(out).contains("<redacted>")
        assertThat(out).doesNotContain("jane.doe@example.com")
    }

    @Test
    fun `scrub redacts phone numbers`() {
        val out = NexusLog.scrub("call +91 9876543210 right now")
        assertThat(out).contains("<redacted>")
        assertThat(out).doesNotContain("9876543210")
    }

    @Test
    fun `scrub leaves safe text untouched`() {
        val safe = "Tool gmail_read_recent finished in 412ms"
        assertThat(NexusLog.scrub(safe)).isEqualTo(safe)
    }
}
