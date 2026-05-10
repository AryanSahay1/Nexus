package com.nexus.app.ui.components.leather

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.clickable
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.stitchedBorder

/**
 * Primary leather button — green-thread stitched, fresh-thread fill.
 *
 * Replaces the old `PrimaryButton`. Reads its colours from the palette
 * directly (not the Material slots) because the button has a strong
 * brand identity that we want consistent across light + dark.
 *
 * 56 dp tall (assistive minimum × 1.27), 16 dp corner radius, ivory text
 * with dashed ivory stitching inset 5 dp. Press state lowers the scale to
 * 0.97 and softens the stitch colour to PandaCream. Loading state replaces
 * the label with an 18 dp ivory spinner and locks the button.
 */
@Composable
fun LeatherButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    cornerRadius: Dp = 16.dp,
    height: Dp = 56.dp
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (pressed && enabled && !loading) 0.97f else 1f,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Fast),
        label = "leatherButtonScale"
    )
    val stitchColour by animateColorAsState(
        targetValue = when {
            !enabled || loading -> LeatherPalette.PandaSlate
            pressed -> LeatherPalette.PandaCream
            else -> LeatherPalette.PandaIvory
        },
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
        label = "leatherButtonStitch"
    )

    val fillBrush = if (enabled && !loading) {
        Brush.radialGradient(
            0f to LeatherPalette.ThreadFresh,
            1f to LeatherPalette.ThreadMoss
        )
    } else {
        Brush.radialGradient(
            0f to LeatherPalette.Tan,
            1f to LeatherPalette.Saddle
        )
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = height)
            .scale(scale)
            .shadow(
                elevation = if (enabled && !loading) 6.dp else 0.dp,
                shape = RoundedCornerShape(cornerRadius),
                ambientColor = LeatherPalette.Deep,
                spotColor = LeatherPalette.Deep
            )
            .clip(RoundedCornerShape(cornerRadius))
            .background(fillBrush)
            .stitchedBorder(
                thread = stitchColour,
                inset = 5.dp,
                cornerRadius = cornerRadius - 5.dp
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled && !loading,
                onClick = onClick
            )
            .semantics { role = Role.Button }
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = LeatherPalette.PandaIvory,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp)
            )
        } else {
            Text(
                text = text,
                style = MaterialTheme.typography.titleMedium,
                color = LeatherPalette.PandaIvory
            )
        }
    }
}

/**
 * Outline leather button — quiet companion to [LeatherButton]. Used for
 * Cancel, Skip, Disconnect, and other reversible actions.
 */
@Composable
fun OutlineLeatherButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    cornerRadius: Dp = 16.dp,
    height: Dp = 56.dp
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed && enabled) 0.98f else 1f,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Fast),
        label = "outlineButtonScale"
    )
    val highlight by animateColorAsState(
        targetValue = if (pressed && enabled) LeatherPalette.PandaCream.copy(alpha = 0.10f)
        else LeatherPalette.PandaCream.copy(alpha = 0.0f),
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
        label = "outlineButtonBg"
    )
    val labelColour = if (enabled) LeatherPalette.PandaCream else LeatherPalette.PandaSlate

    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = height)
            .scale(scale)
            .clip(RoundedCornerShape(cornerRadius))
            .background(highlight)
            .stitchedBorder(
                thread = if (enabled) LeatherPalette.ThreadMoss else LeatherPalette.PandaSlate,
                inset = 4.dp,
                cornerRadius = cornerRadius - 4.dp,
                strokeWidth = 1.5.dp
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                onClick = onClick
            )
            .semantics { role = Role.Button }
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleMedium,
            color = labelColour
        )
    }
}

