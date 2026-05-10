package com.nexus.app.ui.theme.leather

import androidx.compose.ui.graphics.Color
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import kotlin.math.pow

/**
 * Sanity / contrast tests for the Panda Leather palette. These don't test
 * the rendering — they assert the brand promise: the foreground/background
 * pairs the design system uses meet WCAG AA (≥ 4.5:1 for body text,
 * ≥ 3:1 for large text and non-text UI). A regression here means a
 * future palette tweak silently broke accessibility.
 */
class LeatherPaletteTest {

    @Test fun `body text on Tobacco passes WCAG AA`() {
        assertThat(contrast(LeatherPalette.PandaCream, LeatherPalette.Tobacco))
            .isAtLeast(4.5)
    }

    @Test fun `body text on Walnut passes WCAG AA`() {
        assertThat(contrast(LeatherPalette.PandaCream, LeatherPalette.Walnut))
            .isAtLeast(4.5)
    }

    @Test fun `headline ivory on Walnut passes AAA`() {
        assertThat(contrast(LeatherPalette.PandaIvory, LeatherPalette.Walnut))
            .isAtLeast(7.0)
    }

    @Test fun `light-mode body text passes WCAG AA`() {
        assertThat(contrast(LeatherPalette.PandaCharcoal, LeatherPalette.PandaIvory))
            .isAtLeast(4.5)
    }

    @Test fun `ThreadFresh on Tobacco passes large-text AA`() {
        // Used for selected tab labels (≥18 sp), so the 3:1 large-text bar
        // is the relevant threshold.
        assertThat(contrast(LeatherPalette.ThreadFresh, LeatherPalette.Tobacco))
            .isAtLeast(3.0)
    }

    @Test fun `palette enums never collide`() {
        val all = listOf(
            LeatherPalette.Deep, LeatherPalette.Walnut, LeatherPalette.Tobacco,
            LeatherPalette.Saddle, LeatherPalette.Tan, LeatherPalette.Glint,
            LeatherPalette.ThreadMoss, LeatherPalette.ThreadFresh, LeatherPalette.ThreadLime,
            LeatherPalette.PandaCream, LeatherPalette.PandaIvory, LeatherPalette.PandaCharcoal,
            LeatherPalette.PandaSlate, LeatherPalette.WarningAmber, LeatherPalette.ErrorOxblood
        )
        assertThat(all.toSet().size).isEqualTo(all.size)
    }
}

/** WCAG relative-luminance contrast ratio between two sRGB colours. */
internal fun contrast(a: Color, b: Color): Double {
    val la = relativeLuminance(a)
    val lb = relativeLuminance(b)
    val (lighter, darker) = if (la >= lb) la to lb else lb to la
    return (lighter + 0.05) / (darker + 0.05)
}

private fun relativeLuminance(c: Color): Double {
    val r = channel(c.red.toDouble())
    val g = channel(c.green.toDouble())
    val b = channel(c.blue.toDouble())
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

private fun channel(srgb: Double): Double =
    if (srgb <= 0.03928) srgb / 12.92 else ((srgb + 0.055) / 1.055).pow(2.4)
