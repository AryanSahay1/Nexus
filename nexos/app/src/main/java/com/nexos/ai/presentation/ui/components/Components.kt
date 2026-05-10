package com.nexos.ai.presentation.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Notes
import androidx.compose.material.icons.filled.Screenshot
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.nexos.ai.data.local.entity.Note
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.ui.theme.NexosSurfaceHigh
import com.nexos.ai.util.toRelativeTimeString
import kotlin.math.sin

/* --------------------- Note card --------------------- */

@Composable
fun NoteCard(
    note: Note,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enterDelayMillis: Int = 0
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(enterDelayMillis.toLong())
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter   = fadeIn(NexosMotion.enter()) +
                  scaleIn(NexosMotion.enter(), initialScale = 0.96f),
        exit    = fadeOut(NexosMotion.exit())
    ) {
        val interaction = remember { MutableInteractionSource() }
        val pressed by interaction.collectIsPressedAsState()
        val pressScale by animateFloatAsState(
            targetValue = if (pressed) 0.985f else 1f,
            animationSpec = NexosMotion.snappy(),
            label = "press"
        )
        val elevation by animateDpAsState(
            targetValue = if (pressed) 2.dp else 6.dp,
            animationSpec = NexosMotion.normal(), label = "elev"
        )

        Surface(
            shape = RoundedCornerShape(18.dp),
            color = NexosSurface,
            shadowElevation = elevation,
            tonalElevation = 2.dp,
            modifier = modifier
                .fillMaxWidth()
                .scale(pressScale)
                .clickable(interactionSource = interaction, indication = null) { onClick() }
        ) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SourceBadge(sourceType = note.sourceType)
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text  = note.timestamp.toRelativeTimeString(),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    text  = note.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2
                )
                if (note.summary.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text  = note.summary,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3
                    )
                } else if (note.content.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text  = note.content.take(180),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3
                    )
                }
            }
        }
    }
}

@Composable
fun SourceBadge(sourceType: String, modifier: Modifier = Modifier) {
    val icon: ImageVector
    val label: String
    val tint: Color
    when (sourceType) {
        "screenshot" -> { icon = Icons.Default.Screenshot; label = "Screenshot"; tint = NexosPrimary }
        "voice"      -> { icon = Icons.Default.Mic;        label = "Voice";      tint = Color(0xFF4DA6FF) }
        else         -> { icon = Icons.Default.Notes;      label = "Manual";     tint = Color(0xFFFFB800) }
    }
    Surface(
        shape = RoundedCornerShape(50),
        color = NexosSurfaceHigh,
        border = androidx.compose.foundation.BorderStroke(1.dp, tint.copy(alpha = 0.4f)),
        modifier = modifier
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                label,
                color = tint,
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}

/* --------------------- Loading + workflow chip --------------------- */

@Composable
fun LoadingPulse(
    color: Color = NexosPrimary,
    modifier: Modifier = Modifier,
    label: String = "Working"
) {
    val pulse = remember { androidx.compose.animation.core.Animatable(0f) }
    LaunchedEffect(Unit) {
        pulse.animateTo(
            1f,
            animationSpec = androidx.compose.animation.core.infiniteRepeatable(
                animation = androidx.compose.animation.core.tween(900, easing = NexosMotion.EaseInOut),
                repeatMode = androidx.compose.animation.core.RepeatMode.Reverse
            )
        )
    }
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .graphicsLayer { scaleX = 0.6f + 0.6f * pulse.value; scaleY = 0.6f + 0.6f * pulse.value }
                .background(color, CircleShape)
        )
        Text(label, color = color, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun CapsuleProgressIndicator(
    text: String,
    icon: ImageVector = Icons.Default.AutoAwesome,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(50),
        color = NexosSurfaceHigh,
        modifier = modifier.border(
            width = 1.dp,
            brush = Brush.linearGradient(listOf(NexosPrimary, Color(0xFF4DA6FF))),
            shape = RoundedCornerShape(50)
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(14.dp),
                color = NexosPrimary,
                strokeWidth = 1.5.dp
            )
            Spacer(Modifier.width(10.dp))
            Text(text, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

/* --------------------- Empty state --------------------- */

@Composable
fun EmptyNotesView(
    title: String,
    body: String,
    modifier: Modifier = Modifier
) {
    val ambient = remember { androidx.compose.animation.core.Animatable(0f) }
    LaunchedEffect(Unit) {
        ambient.animateTo(
            1f,
            animationSpec = androidx.compose.animation.core.infiniteRepeatable(
                animation = androidx.compose.animation.core.tween(3200, easing = NexosMotion.EaseInOut),
                repeatMode = androidx.compose.animation.core.RepeatMode.Reverse
            )
        )
    }
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .graphicsLayer {
                    val t = ambient.value
                    val s = 0.95f + 0.06f * (0.5f + 0.5f * sin(t * 2 * Math.PI.toFloat()))
                    scaleX = s; scaleY = s
                    alpha  = 0.85f + 0.15f * t
                }
                .background(
                    brush = Brush.radialGradient(
                        listOf(NexosPrimary.copy(alpha = 0.35f), Color.Transparent)
                    ),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Default.AutoAwesome,
                contentDescription = null,
                tint = NexosPrimary,
                modifier = Modifier.size(56.dp)
            )
        }
        Spacer(Modifier.height(20.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onSurface)
        Spacer(Modifier.height(8.dp))
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 12.dp)
        )
    }
}
