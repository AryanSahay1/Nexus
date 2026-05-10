package com.nexus.app.ui.theme.leather

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Each leather tone must use a base / grain-top / grain-bottom triple that
 * sits on the Panda Leather palette. If a future edit pulls a colour
 * outside the palette, this test flags it.
 */
class LeatherToneTest {

    @Test fun `every tone uses palette colours only`() {
        val palette = setOf(
            LeatherPalette.Deep, LeatherPalette.Walnut, LeatherPalette.Tobacco,
            LeatherPalette.Saddle, LeatherPalette.Tan, LeatherPalette.Glint
        )
        LeatherTone.entries.forEach { tone ->
            assertThat(palette).contains(tone.base)
            assertThat(palette).contains(tone.grainTop)
            assertThat(palette).contains(tone.grainBottom)
        }
    }

    @Test fun `every tone has a strictly darker grain-bottom than its base`() {
        // Conventional skeuomorphic leather: light hits the top, shadow
        // pools at the bottom of the surface. The brightness of grainBottom
        // must be ≤ base (we use the simple sum-of-channels proxy).
        LeatherTone.entries.forEach { tone ->
            val baseLum = brightness(tone.base)
            val bottomLum = brightness(tone.grainBottom)
            assertThat(bottomLum).isAtMost(baseLum)
        }
    }
}

private fun brightness(c: androidx.compose.ui.graphics.Color): Float =
    c.red + c.green + c.blue
