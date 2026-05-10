package com.nexus.app.data.secure

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Test

/**
 * The auth state bus is the link between Settings/Onboarding/Vault and the
 * root navigator. If publish() is dropped, the user can be stranded on the
 * factory-reset Settings tab without being routed back to onboarding (B-24).
 */
class AuthStateBusTest {

    @Test
    fun `publish delivers exactly one event to an attached collector`() =
        runTest(UnconfinedTestDispatcher()) {
            val bus = AuthStateBus()
            val collected = mutableListOf<Unit>()
            val job = launch { bus.events.collect { collected += it } }
            // Unconfined dispatcher → the launch above starts immediately and
            // the collector is attached before publish() runs.
            bus.publish()
            assertThat(collected).hasSize(1)
            job.cancel()
        }

    @Test
    fun `publish before subscribers are attached is dropped (replay = 0)`() =
        runTest(UnconfinedTestDispatcher()) {
            val bus = AuthStateBus()
            bus.publish()
            val collected = mutableListOf<Unit>()
            val job = launch { bus.events.collect { collected += it } }
            // No replay buffer, so the pre-subscription emission must NOT be
            // observed retroactively.
            assertThat(collected).isEmpty()
            bus.publish()
            assertThat(collected).hasSize(1)
            job.cancel()
        }
}
