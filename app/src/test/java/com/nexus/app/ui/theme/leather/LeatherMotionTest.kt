package com.nexus.app.ui.theme.leather

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Guard rails on the motion system. The skill file requires durations to
 * stay ≤ 700 ms (UI tier) and ≤ 200 ms for micro-interactions, plus a
 * non-zero baseline. If these constants drift, the whole app feels off
 * — these tests catch the regression at build time.
 */
class LeatherMotionTest {

    @Test fun `duration scale is monotonic`() {
        val scale = listOf(
            LeatherMotion.Instant,
            LeatherMotion.Fast,
            LeatherMotion.Normal,
            LeatherMotion.Moderate,
            LeatherMotion.Slow,
            LeatherMotion.Expressive
        )
        assertThat(scale).isInOrder()
    }

    @Test fun `instant is exactly zero`() {
        assertThat(LeatherMotion.Instant).isEqualTo(0)
    }

    @Test fun `every duration is at most 700 ms`() {
        val durations = listOf(
            LeatherMotion.Fast, LeatherMotion.Normal, LeatherMotion.Moderate,
            LeatherMotion.Slow, LeatherMotion.Expressive
        )
        durations.forEach { assertThat(it).isAtMost(700) }
    }

    @Test fun `micro-interaction tier is below 200 ms`() {
        // Fast is reserved for hover / press / tab indicator slide — the
        // skill file caps that tier at 200 ms.
        assertThat(LeatherMotion.Fast).isAtMost(200)
    }

    @Test fun `easing functions exist and are distinct`() {
        // Smoke-test: distinct CubicBezierEasing instances. We can't easily
        // sample a curve from a unit test (no Compose runtime), so identity
        // distinctness is the cheap check.
        assertThat(LeatherMotion.EaseOutLeather).isNotSameInstanceAs(LeatherMotion.EaseInLeather)
        assertThat(LeatherMotion.EaseOutLeather).isNotSameInstanceAs(LeatherMotion.EaseSpring)
        assertThat(LeatherMotion.EaseInLeather).isNotSameInstanceAs(LeatherMotion.EaseSpring)
    }
}
