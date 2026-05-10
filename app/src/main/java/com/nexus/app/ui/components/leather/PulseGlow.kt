package com.nexus.app.ui.components.leather

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.reduceMotion

/**
 * pulseGlow — Modifier that paints a softly breathing glow border around
 * its target.
 *
 * Implements UI/UX skill §12 (Micro-Interactions — pulsating attention
 * cues). Use sparingly: only for elements the user genuinely needs to
 * notice, e.g. a "Connect Google" CTA, a recording mic, a status pill
 * that just changed to "active".
 *
 * The glow is drawn behind the content and pulses opacity between
 * `minAlpha` and `maxAlpha` over `periodMs`. Reduced-motion users see
 * a static glow at `(min + max) / 2` — still attention-grabbing, just
 * not pulsing.
 */
fun Modifier.pulseGlow(
    color: Color = LeatherPalette.ThreadFresh,
    cornerRadius: Dp = 16.dp,
    strokeWidth: Dp = 2.dp,
    minAlpha: Float = 0.25f,
    maxAlpha: Float = 0.75f,
    periodMs: Int = LeatherMotion.Slow + LeatherMotion.Slow
): Modifier = composed {
    val reduce = reduceMotion()
    val alpha = if (reduce) {
        (minAlpha + maxAlpha) / 2f
    } else {
        val transition = rememberInfiniteTransition(label = "pulseGlow")
        val animated by transition.animateFloat(
            initialValue = minAlpha,
            targetValue = maxAlpha,
            animationSpec = infiniteRepeatable(
                animation = tween(
                    durationMillis = periodMs / 2,
                    easing = LeatherMotion.EaseOutLeather
                ),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulseGlowAlpha"
        )
        animated
    }

    drawBehind {
        // Outer halo: thicker stroke at low opacity for the glow; inner
        // stroke is the crisp accent line.
        val crSize = CornerRadius(cornerRadius.toPx(), cornerRadius.toPx())
        val haloStroke = Stroke(width = strokeWidth.toPx() * 3f)
        val coreStroke = Stroke(width = strokeWidth.toPx())
        drawRoundRect(
            color = color.copy(alpha = alpha * 0.35f),
            topLeft = Offset.Zero,
            size = Size(size.width, size.height),
            cornerRadius = crSize,
            style = haloStroke
        )
        drawRoundRect(
            color = color.copy(alpha = alpha),
            topLeft = Offset.Zero,
            size = Size(size.width, size.height),
            cornerRadius = crSize,
            style = coreStroke
        )
    }
}
