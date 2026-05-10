package com.nexus.app.ui.components.leather

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.reduceMotion

/**
 * LeatherShimmer — placeholder block with a tan highlight that sweeps
 * left → right.
 *
 * Implements UI/UX skill §15 (Loading & Skeleton States): never show a
 * blank screen, never show a generic spinner where the shape of the
 * data is known. A shimmer block telegraphs "row is coming" before the
 * data arrives.
 *
 * Reduced-motion users see a static dim block — still legible as
 * "loading", just without the sweep.
 */
@Composable
fun LeatherShimmer(
    modifier: Modifier = Modifier,
    width: Dp? = null,
    height: Dp = 16.dp,
    cornerRadius: Dp = 6.dp,
    base: Color = LeatherPalette.Saddle.copy(alpha = 0.55f),
    highlight: Color = LeatherPalette.PandaCream.copy(alpha = 0.18f)
) {
    val reduce = reduceMotion()

    val sized = (if (width != null) modifier.size(width = width, height = height)
    else modifier.fillMaxWidth().height(height))
        .clip(RoundedCornerShape(cornerRadius))
        .background(base)

    if (reduce) {
        Box(modifier = sized)
        return
    }

    val transition = rememberInfiniteTransition(label = "leatherShimmer")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "leatherShimmerPhase"
    )

    Box(
        modifier = sized.drawWithContent {
            drawContent()
            // Build a translucent sweep band that travels from −width to
            // +width as `phase` goes 0 → 1.
            val bandWidth = size.width * 0.45f
            val travel = size.width + bandWidth
            val xStart = -bandWidth + travel * phase
            val xEnd = xStart + bandWidth
            drawRect(
                brush = Brush.horizontalGradient(
                    0f to Color.Transparent,
                    0.5f to highlight,
                    1f to Color.Transparent,
                    startX = xStart,
                    endX = xEnd
                ),
                topLeft = Offset(0f, 0f),
                size = size,
                blendMode = BlendMode.SrcAtop
            )
        }
    )
}

/**
 * A pre-composed three-line shimmer row matching the email/calendar/memory
 * row layouts. Stack `repeat(N)` of these in a Column for a faithful
 * loading state.
 */
@Composable
fun LeatherShimmerRow(
    modifier: Modifier = Modifier,
    avatar: Boolean = true
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (avatar) {
            LeatherShimmer(width = 36.dp, height = 36.dp, cornerRadius = 18.dp)
        }
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            LeatherShimmer(height = 12.dp, cornerRadius = 6.dp)
            LeatherShimmer(height = 14.dp, cornerRadius = 6.dp)
            LeatherShimmer(width = 200.dp, height = 10.dp, cornerRadius = 6.dp)
        }
    }
}
