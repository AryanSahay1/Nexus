package com.nexus.app.ui.components.leather

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.LeatherTone
import com.nexus.app.ui.theme.leather.leatherSurface
import com.nexus.app.ui.theme.leather.stitchedBorder

/**
 * A leather pouch card with stitched border. Replaces every Material3
 * Card in the app — tutorial rows, vault tiles, memory rows, the
 * confirmation card. Style spec: PRD §8.
 */
@Composable
fun LeatherCard(
    modifier: Modifier = Modifier,
    tone: LeatherTone = LeatherTone.Tobacco,
    variant: LeatherCardVariant = LeatherCardVariant.Standard,
    elevationLevel: Int = 1,
    grainSeed: Int = 0,
    interactionSource: MutableInteractionSource? = null,
    cornerRadius: Dp = 20.dp,
    contentPadding: Dp = 20.dp,
    content: @Composable () -> Unit
) {
    val source = interactionSource ?: remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.97f else 1f,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Fast),
        label = "leatherCardScale"
    )

    val activeThread = when (variant) {
        LeatherCardVariant.Standard -> LeatherPalette.ThreadMoss
        LeatherCardVariant.Highlight -> LeatherPalette.ThreadFresh
        LeatherCardVariant.Warning -> LeatherPalette.WarningAmber
        LeatherCardVariant.Error -> LeatherPalette.ErrorOxblood
    }
    val threadColour by animateColorAsState(
        targetValue = if (pressed) LeatherPalette.ThreadFresh else activeThread,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
        label = "leatherCardStitch"
    )

    val shadowDp = elevationDp(elevationLevel)

    androidx.compose.foundation.layout.Box(
        modifier = modifier
            .scale(scale)
            .shadow(
                elevation = shadowDp,
                shape = RoundedCornerShape(cornerRadius),
                ambientColor = LeatherPalette.Deep,
                spotColor = LeatherPalette.Deep
            )
            .clip(RoundedCornerShape(cornerRadius))
            .leatherSurface(tone = tone, cornerRadius = cornerRadius, grainSeed = grainSeed)
            .stitchedBorder(thread = threadColour, cornerRadius = cornerRadius - 6.dp)
            .padding(contentPadding)
    ) {
        // Default content colour matches the leather: ivory on dark cards,
        // charcoal on light. Components inside can still override.
        val onSurface = MaterialTheme.colorScheme.onSurface
        CompositionLocalProvider(LocalContentColor provides onSurface) {
            content()
        }
    }
}

enum class LeatherCardVariant {
    /** Default moss-green stitching. */
    Standard,
    /** Fresh-green stitching — selected/connected state. */
    Highlight,
    /** Amber stitching — destructive confirmation card. */
    Warning,
    /** Oxblood stitching — error/blocked. */
    Error
}

private fun elevationDp(level: Int): Dp = when (level) {
    0 -> 0.dp
    1 -> 2.dp
    2 -> 6.dp
    3 -> 14.dp
    else -> 24.dp
}
