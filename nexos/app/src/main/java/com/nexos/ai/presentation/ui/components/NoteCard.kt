package com.nexos.ai.presentation.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexos.ai.domain.model.Note
import com.nexos.ai.domain.model.SourceType
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.ui.theme.NexosOnSurface
import com.nexos.ai.presentation.ui.theme.NexosOnSurfaceMuted
import com.nexos.ai.presentation.ui.theme.NexosOutline
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.ui.theme.NexosSurfaceElevated
import com.nexos.ai.util.toRelativeTimeString

@Composable
fun NoteCard(
    note: Note,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    visible: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.985f else 1f,
        animationSpec = NexosMotion.tweenEnter(NexosMotion.Fast),
        label = "card-press",
    )

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(NexosMotion.tweenEnter(NexosMotion.Slow)) +
            expandVertically(NexosMotion.tweenEnter(NexosMotion.Slow)),
        exit = fadeOut(NexosMotion.tweenExit()) + shrinkVertically(NexosMotion.tweenExit()),
    ) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .scale(scale)
                .clip(RoundedCornerShape(18.dp))
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(NexosSurface, NexosSurfaceElevated),
                    ),
                )
                .border(width = 1.dp, color = NexosOutline, shape = RoundedCornerShape(18.dp))
                .clickable(interactionSource = interaction, indication = null, onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SourceIcon(note.sourceType)
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = note.title.ifBlank { "Untitled" },
                        color = NexosOnSurface,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = note.timestamp.toRelativeTimeString(),
                        color = NexosOnSurfaceMuted,
                        fontSize = 12.sp,
                    )
                }
                if (note.summary.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = note.summary,
                        color = NexosOnSurfaceMuted,
                        fontSize = 13.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                } else if (note.content.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = note.content,
                        color = NexosOnSurfaceMuted,
                        fontSize = 13.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (note.tags.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        note.tags.take(3).forEach { tag ->
                            TagChip(tag)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceIcon(source: SourceType) {
    val icon = when (source) {
        SourceType.Screenshot -> Icons.Outlined.Image
        SourceType.Voice -> Icons.Filled.Mic
        SourceType.Manual -> Icons.Outlined.StickyNote2
    }
    Box(
        modifier = Modifier
            .size(28.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(NexosPrimary.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = source.key,
            tint = NexosPrimary,
            modifier = Modifier.size(16.dp),
        )
    }
}

@Composable
private fun TagChip(label: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(NexosOutline.copy(alpha = 0.5f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text = label, color = Color(0xFFB8BCC8), fontSize = 11.sp)
    }
}
