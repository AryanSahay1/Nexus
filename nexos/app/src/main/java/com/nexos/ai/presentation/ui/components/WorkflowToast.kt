package com.nexos.ai.presentation.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexos.ai.domain.model.WorkflowState
import com.nexos.ai.presentation.ui.theme.NexosError
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.ui.theme.NexosOnSurface
import com.nexos.ai.presentation.ui.theme.NexosOutlineStrong
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSurfaceElevated

@Composable
fun WorkflowToast(state: WorkflowState, modifier: Modifier = Modifier) {
    val visible = state !is WorkflowState.Idle
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(NexosMotion.tweenSpringy(NexosMotion.Slow)) { it } +
            fadeIn(NexosMotion.tweenEnter()),
        exit = slideOutVertically(tween(NexosMotion.Normal)) { it } +
            fadeOut(NexosMotion.tweenExit()),
        modifier = modifier,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Start,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(NexosSurfaceElevated)
                .border(1.dp, NexosOutlineStrong, RoundedCornerShape(14.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            val (label, color) = labelFor(state)
            PulsingDot(color = color, sizeDp = 12)
            Spacer(Modifier.width(12.dp))
            Text(
                text = label,
                color = NexosOnSurface,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

private fun labelFor(state: WorkflowState) = when (state) {
    WorkflowState.Idle -> "Idle" to NexosPrimary
    WorkflowState.Capturing -> "Capturing screen…" to NexosPrimary
    WorkflowState.ExtractingText -> "Reading text via OCR…" to NexosPrimary
    WorkflowState.AiProcessing -> "AI is shaping the note…" to NexosPrimary
    WorkflowState.Saving -> "Saving…" to NexosPrimary
    is WorkflowState.Done -> "Saved: ${state.note.title}" to NexosPrimary
    is WorkflowState.Failed -> "${state.step}: ${state.error}" to NexosError
}
