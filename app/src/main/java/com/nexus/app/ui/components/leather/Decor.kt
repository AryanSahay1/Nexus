package com.nexus.app.ui.components.leather

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette

/**
 * Thin horizontal hand-stitched divider. 1.5 dp dashed thread in
 * `ThreadMoss` (or whatever colour the caller passes).
 */
@Composable
fun StitchedDivider(
    modifier: Modifier = Modifier,
    thread: androidx.compose.ui.graphics.Color = LeatherPalette.ThreadMoss,
    strokeWidth: Dp = 1.5.dp,
    dashLength: Dp = 6.dp,
    gapLength: Dp = 4.dp
) {
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(strokeWidth)
    ) {
        val dash = dashLength.toPx()
        val gap = gapLength.toPx()
        drawLine(
            color = thread,
            start = Offset(0f, size.height / 2),
            end = Offset(size.width, size.height / 2),
            strokeWidth = strokeWidth.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, gap), 0f)
        )
    }
}

/**
 * Tutorial-step progress indicator. The current step expands to 24 dp
 * wide and tints to `ThreadFresh`; the others stay at 8 dp pills in
 * faded `Tan`. Width and colour both animate so the change feels
 * weighted (PRD §8 — ProgressDots).
 */
@Composable
fun ProgressDots(
    currentIndex: Int,
    totalSteps: Int,
    modifier: Modifier = Modifier,
    inactiveColor: androidx.compose.ui.graphics.Color = LeatherPalette.Tan.copy(alpha = 0.45f),
    activeColor: androidx.compose.ui.graphics.Color = LeatherPalette.ThreadFresh
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)
    ) {
        repeat(totalSteps) { index ->
            val isActive = index == currentIndex
            val width by animateDpAsState(
                targetValue = if (isActive) 24.dp else 8.dp,
                animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
                label = "progressDotWidth"
            )
            val colour by animateColorAsState(
                targetValue = if (isActive) activeColor else inactiveColor,
                animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
                label = "progressDotColour"
            )
            Box(
                modifier = Modifier
                    .height(8.dp)
                    .width(width)
                    .clip(RoundedCornerShape(4.dp))
                    .background(colour)
            )
        }
    }
}

/**
 * Three-dot "thinking" indicator used by the chat agent's PROCESSING
 * state. Each dot scales 0.6 → 1.0 → 0.6 in a phased loop — gives the
 * impression of a quill scratching against the leather.
 */
@Composable
fun ThinkingDots(
    modifier: Modifier = Modifier,
    color: androidx.compose.ui.graphics.Color = LeatherPalette.PandaCream
) {
    if (com.nexus.app.ui.theme.leather.reduceMotion()) {
        // Reduced-motion users get a single static dot triplet — still
        // legible as "the agent is busy" without the pulsing.
        Row(
            modifier = modifier,
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(4.dp)
        ) {
            repeat(3) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(color.copy(alpha = 0.6f))
                )
            }
        }
        return
    }
    val infinite = rememberInfiniteTransition(label = "thinkingDots")
    Row(
        modifier = modifier,
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(4.dp)
    ) {
        repeat(3) { i ->
            val phase by infinite.animateFloat(
                initialValue = 0.6f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(
                        durationMillis = 600,
                        delayMillis = i * 120,
                        easing = LeatherMotion.EaseOutLeather
                    ),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "thinkingDotPhase$i"
            )
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(color.copy(alpha = phase))
            )
        }
    }
}

/**
 * Stitched leather corner check-mark — a small green cross-stitch we draw
 * in the top-right of vault pouches when a service is connected. Pure
 * canvas, no resources.
 */
@Composable
fun StitchedCheck(
    modifier: Modifier = Modifier,
    size: Dp = 20.dp,
    thread: androidx.compose.ui.graphics.Color = LeatherPalette.ThreadLime
) {
    Canvas(modifier = modifier.padding(2.dp).size(size)) {
        val pad = this.size.minDimension * 0.18f
        val w = this.size.width
        val h = this.size.height
        val stroke = Stroke(
            width = 2.5f * density,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f * density, 2f * density), 0f)
        )
        drawLine(
            color = thread,
            start = Offset(pad, h * 0.55f),
            end = Offset(w * 0.42f, h - pad),
            strokeWidth = stroke.width,
            pathEffect = stroke.pathEffect
        )
        drawLine(
            color = thread,
            start = Offset(w * 0.42f, h - pad),
            end = Offset(w - pad, pad),
            strokeWidth = stroke.width,
            pathEffect = stroke.pathEffect
        )
    }
}

/** Spacer with a leather-strap look — used between bottom nav and content. */
@Composable
fun LeatherStrap(modifier: Modifier = Modifier, height: Dp = 6.dp) {
    Spacer(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .background(LeatherPalette.Deep.copy(alpha = 0.45f))
    )
}
