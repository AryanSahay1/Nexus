package com.nexus.app.ui.theme.leather

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Procedural leather surface texture (no bitmap, no res tax).
 *
 * Layered passes inside `drawBehind` (see `docs/UI_DESIGN_PRD.md §6`):
 *   1. Base fill in [tone] (Tobacco for cards, Walnut for the page).
 *   2. Vertical grain gradient — Saddle on top fading to Deep at the
 *      bottom, alpha 0.18, mimics light catching the surface.
 *   3. Three radial highlight hotspots seeded by the consumer (so the
 *      same surface re-composes with the same grain — stable, not
 *      flickery).
 *   4. Inner-edge vignette to give the leather centre a subtle bulge.
 *
 * The result is a single composited layer, so it costs the same as a flat
 * fill. Works equally well on tiny chips (chat bubbles) and full-screen
 * scaffolds (the Tabs root).
 */
fun Modifier.leatherSurface(
    tone: LeatherTone = LeatherTone.Tobacco,
    cornerRadius: Dp = 0.dp,
    grainSeed: Int = 0
): Modifier = this
    .let { if (cornerRadius > 0.dp) it.clip(RoundedCornerShape(cornerRadius)) else it }
    .drawBehind {
        val base = tone.base
        val grainTop = tone.grainTop
        val grainBottom = tone.grainBottom

        // (1) base fill
        drawRect(color = base, size = size)

        // (2) vertical grain gradient
        drawRect(
            brush = Brush.verticalGradient(
                0f to grainTop.copy(alpha = 0.18f),
                1f to grainBottom.copy(alpha = 0.22f)
            ),
            size = size
        )

        // (3) three highlight hotspots — positions are deterministic from
        // grainSeed so a recomposition does not move them.
        val hotspots = hotspotsFor(grainSeed, size)
        hotspots.forEach { (centre, radius, alpha) ->
            drawCircle(
                brush = Brush.radialGradient(
                    0f to LeatherPalette.Glint.copy(alpha = alpha),
                    1f to Color.Transparent,
                    center = centre,
                    radius = radius
                ),
                center = centre,
                radius = radius
            )
        }

        // (4) inner edge vignette — eight strokes at decreasing alpha
        // simulate inner shadow without an extra Layer pass.
        val vignetteAlpha = 0.10f
        drawRect(
            brush = Brush.radialGradient(
                0.6f to Color.Transparent,
                1f to LeatherPalette.Deep.copy(alpha = vignetteAlpha),
                center = Offset(size.width / 2, size.height / 2),
                radius = maxOf(size.width, size.height) * 0.75f
            ),
            size = size
        )
    }

private fun hotspotsFor(seed: Int, size: Size): List<Triple<Offset, Float, Float>> {
    // Tiny PRNG — keeps the highlight positions stable per `seed` and
    // independent across surfaces so adjacent cards don't all glint in
    // the same place. The constant is the golden-ratio mixing value used
    // by SplitMix64.
    val rng = java.util.Random((seed.toLong() shl 16) xor -0x61c8864680b583ebL)
    return List(3) {
        val cx = (0.18f + rng.nextFloat() * 0.64f) * size.width
        val cy = (0.10f + rng.nextFloat() * 0.80f) * size.height
        val radius = (0.30f + rng.nextFloat() * 0.40f) * minOf(size.width, size.height)
        val alpha = 0.05f + rng.nextFloat() * 0.05f
        Triple(Offset(cx, cy), radius, alpha)
    }
}

/**
 * Draws a green hand-stitched dashed border 6 dp inside the rounded rect.
 * 1.5 dp stroke, 6 dp dash, 4 dp gap — see PRD §5. Use [thread] to override
 * the stitch colour for active / warning surfaces.
 */
fun Modifier.stitchedBorder(
    thread: Color = LeatherPalette.ThreadMoss,
    inset: Dp = 6.dp,
    cornerRadius: Dp = 14.dp,
    strokeWidth: Dp = 1.5.dp,
    dashLength: Dp = 6.dp,
    gapLength: Dp = 4.dp
): Modifier = this.drawBehind {
    val insetPx = inset.toPx()
    val stroke = strokeWidth.toPx()
    val dash = dashLength.toPx()
    val gap = gapLength.toPx()
    val radius = cornerRadius.toPx()

    val cornerArc = androidx.compose.ui.geometry.CornerRadius(radius)
    drawRoundRect(
        color = thread,
        topLeft = Offset(insetPx, insetPx),
        size = Size(size.width - insetPx * 2, size.height - insetPx * 2),
        cornerRadius = cornerArc,
        style = Stroke(
            width = stroke,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, gap), 0f)
        )
    )
}

/**
 * Tonal variants of the leather. `Tobacco` is the standard card; `Walnut`
 * is the deeper page background; `Saddle` is used for chat-bubble
 * accents; `Worn` desaturates to suggest a disabled / faded state.
 */
enum class LeatherTone(
    internal val base: Color,
    internal val grainTop: Color,
    internal val grainBottom: Color
) {
    Tobacco(
        base = LeatherPalette.Tobacco,
        grainTop = LeatherPalette.Saddle,
        grainBottom = LeatherPalette.Deep
    ),
    Walnut(
        base = LeatherPalette.Walnut,
        grainTop = LeatherPalette.Tobacco,
        grainBottom = LeatherPalette.Deep
    ),
    Saddle(
        base = LeatherPalette.Saddle,
        grainTop = LeatherPalette.Tan,
        grainBottom = LeatherPalette.Tobacco
    ),
    Worn(
        base = LeatherPalette.Tan,
        grainTop = LeatherPalette.Glint,
        grainBottom = LeatherPalette.Saddle
    )
}
