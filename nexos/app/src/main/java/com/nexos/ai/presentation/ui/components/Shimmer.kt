package com.nexos.ai.presentation.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.nexos.ai.presentation.ui.theme.NexosSurfaceElevated
import com.nexos.ai.presentation.ui.theme.NexosSurfaceHigh

/** Skeleton block with horizontal shimmer (motion §15). */
@Composable
fun ShimmerBlock(
    modifier: Modifier = Modifier,
    cornerRadius: Int = 8,
) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translate by transition.animateFloat(
        initialValue = -1f,
        targetValue = 2f,
        animationSpec = infiniteRepeatable(animation = tween(1500, easing = LinearEasing)),
        label = "shimmer-x",
    )
    Spacer(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius.dp))
            .background(NexosSurfaceElevated)
            .drawWithCache {
                val width = size.width
                val gradient = Brush.linearGradient(
                    colors = listOf(
                        NexosSurfaceElevated,
                        NexosSurfaceHigh,
                        NexosSurfaceElevated,
                    ),
                    start = Offset(translate * width, 0f),
                    end = Offset(translate * width + width, 0f),
                )
                onDrawWithContent {
                    drawContent()
                    drawRect(brush = gradient)
                }
            },
    )
}

@Composable
fun SkeletonCard(modifier: Modifier = Modifier) {
    androidx.compose.foundation.layout.Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Transparent),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
    ) {
        ShimmerBlock(modifier = Modifier.fillMaxWidth(0.6f).height(18.dp))
        ShimmerBlock(modifier = Modifier.fillMaxWidth().height(12.dp))
        ShimmerBlock(modifier = Modifier.fillMaxWidth(0.85f).height(12.dp))
    }
}
