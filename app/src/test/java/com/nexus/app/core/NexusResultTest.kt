package com.nexus.app.core

import com.google.common.truth.Truth.assertThat
import java.io.IOException
import org.junit.Test

class NexusResultTest {

    @Test
    fun `Ok carries value and isOk true`() {
        val r = NexusResult.ok(42)
        assertThat(r.isOk).isTrue()
        assertThat(r.isErr).isFalse()
        assertThat(r.getOrNull()).isEqualTo(42)
        assertThat(r.errorOrNull()).isNull()
    }

    @Test
    fun `Err carries error and isErr true`() {
        val err = NexusError(NexusErrorCode.NETWORK, "boom")
        val r = NexusResult.err(err)
        assertThat(r.isErr).isTrue()
        assertThat(r.isOk).isFalse()
        assertThat(r.errorOrNull()).isSameInstanceAs(err)
    }

    @Test
    fun `map transforms Ok and passes Err through`() {
        val ok: NexusResult<Int> = NexusResult.ok(2)
        assertThat(ok.map { it * 5 }.getOrNull()).isEqualTo(10)

        val err: NexusResult<Int> = NexusResult.err(NexusError(NexusErrorCode.UNKNOWN, "x"))
        assertThat(err.map { it * 5 }.isErr).isTrue()
    }

    @Test
    fun `flatMap chains successes and short-circuits on error`() {
        val ok: NexusResult<Int> = NexusResult.ok(2)
        assertThat(ok.flatMap { NexusResult.ok(it + 3) }.getOrNull()).isEqualTo(5)

        val ok2: NexusResult<Int> = NexusResult.ok(2)
        val err = NexusError(NexusErrorCode.UNKNOWN, "stop")
        assertThat(ok2.flatMap { NexusResult.err(err) }.errorOrNull()).isSameInstanceAs(err)
    }

    @Test
    fun `runCatchingNexus turns IOException into a retryable NETWORK error`() {
        val r = runCatchingNexus(NexusErrorCode.UNKNOWN) { throw IOException("offline") }
        val err = r.errorOrNull()!!
        assertThat(err.code).isEqualTo(NexusErrorCode.NETWORK)
        assertThat(err.isRetryable).isTrue()
    }

    @Test
    fun `runCatchingNexus preserves NexusError if thrown directly`() {
        val original = NexusError(NexusErrorCode.RATE_LIMIT, "slow down", isRetryable = true)
        val r = runCatchingNexus(NexusErrorCode.UNKNOWN) { throw original }
        assertThat(r.errorOrNull()).isSameInstanceAs(original)
    }
}
