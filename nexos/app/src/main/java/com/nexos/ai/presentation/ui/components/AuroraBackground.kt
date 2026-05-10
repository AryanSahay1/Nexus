package com.nexos.ai.presentation.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.nexos.ai.presentation.ui.theme.NexosAurora1
import com.nexos.ai.presentation.ui.theme.NexosAurora2
import com.nexos.ai.presentation.ui.theme.NexosAurora3
import com.nexos.ai.presentation.ui.theme.NexosBackground

/**
 * Subtle radial mesh-gradient backdrop that drifts slowly. Pure transform/alpha animations,
 * no layout work, no extra layers — performance-safe at 60fps on mid-range devices.
 */
@Composable
fun AuroraBackground(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "aurora")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 18_000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "phase",
    )

    Box(modifier = modifier.fillMaxSize()) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            // Base background
            drawRect(NexosBackground)

            val w = size.width
            val h = size.height

            val c1 = Offset(w * (0.20f + 0.20f * phase), h * (0.18f + 0.10f * (1 - phase)))
            val c2 = Offset(w * (0.85f - 0.15f * phase), h * (0.30f + 0.20f * phase))
            val c3 = Offset(w * (0.15f + 0.30f * (1 - phase)), h * (0.85f - 0.10f * phase))

            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(NexosAurora1.copy(alpha = 0.18f), Color.Transparent),
                    center = c1,
                    radius = w * 0.55f,
                ),
                radius = w * 0.55f,
                center = c1,
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(NexosAurora2.copy(alpha = 0.14f), Color.Transparent),
                    center = c2,
                    radius = w * 0.50f,
                ),
                radius = w * 0.50f,
                center = c2,
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(NexosAurora3.copy(alpha = 0.12f), Color.Transparent),
                    center = c3,
                    radius = w * 0.60f,
                ),
                radius = w * 0.60f,
                center = c3,
            )
        }
    }
}
