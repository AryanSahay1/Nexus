package com.nexos.ai.presentation.ui.voice

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexos.ai.presentation.ui.theme.NexosBackground
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosPrimaryGlow
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.viewmodel.VoiceViewModel
import kotlin.math.sin

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoiceInputBottomSheet(
    onDismiss: () -> Unit,
    viewModel: VoiceViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(state.status) {
        if (state.status == VoiceViewModel.Status.Done) {
            kotlinx.coroutines.delay(700)
            onDismiss()
        }
    }

    ModalBottomSheet(
        onDismissRequest = {
            viewModel.cancel()
            onDismiss()
        },
        sheetState = sheetState,
        containerColor = NexosSurface,
        contentColor = MaterialTheme.colorScheme.onSurface
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            VoiceOrb(state.status)
            Spacer(Modifier.height(20.dp))
            Text(
                text = statusLabel(state.status),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(Modifier.height(8.dp))
            AnimatedVisibility(
                visible = state.transcript.isNotBlank(),
                enter   = fadeIn(),
                exit    = fadeOut()
            ) {
                Text(
                    text = state.transcript,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            AnimatedVisibility(
                visible = state.error != null,
                enter   = fadeIn(), exit = fadeOut()
            ) {
                Text(
                    "${state.error}",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            Spacer(Modifier.height(24.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { viewModel.cancel(); onDismiss() },
                    modifier = Modifier.weight(1f)
                ) { Text("Cancel") }
                Button(
                    onClick = { viewModel.stop() },
                    colors = ButtonDefaults.buttonColors(containerColor = NexosPrimary, contentColor = NexosBackground),
                    modifier = Modifier.weight(1f),
                    enabled = state.status == VoiceViewModel.Status.Listening
                ) { Text("Stop") }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

private fun statusLabel(s: VoiceViewModel.Status): String = when (s) {
    VoiceViewModel.Status.Idle       -> "Tap mic to start"
    VoiceViewModel.Status.Connecting -> "Warming up…"
    VoiceViewModel.Status.Listening  -> "Listening…"
    VoiceViewModel.Status.Processing -> "Processing…"
    VoiceViewModel.Status.Saving     -> "Saving note…"
    VoiceViewModel.Status.Done       -> "Done"
}

@Composable
private fun VoiceOrb(status: VoiceViewModel.Status) {
    val infinite = remember { androidx.compose.animation.core.Animatable(0f) }
    LaunchedEffect(Unit) {
        infinite.animateTo(
            1f,
            animationSpec = infiniteRepeatable(tween(1400), repeatMode = androidx.compose.animation.core.RepeatMode.Reverse)
        )
    }
    val active = status == VoiceViewModel.Status.Listening || status == VoiceViewModel.Status.Connecting
    val pulse by animateFloatAsState(
        targetValue = if (active) 1f else 0f,
        animationSpec = tween(280), label = "pulse"
    )
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.size(140.dp)
    ) {
        // outer glow
        Box(
            modifier = Modifier
                .size(140.dp)
                .graphicsLayer {
                    val t = infinite.value
                    val s = 0.85f + 0.18f * (0.5f + 0.5f * sin(t * 2 * Math.PI.toFloat()))
                    scaleX = s; scaleY = s
                    alpha = 0.55f * pulse
                }
                .background(
                    brush = Brush.radialGradient(listOf(NexosPrimaryGlow, androidx.compose.ui.graphics.Color.Transparent)),
                    shape = CircleShape
                )
        )
        // core orb
        Box(
            modifier = Modifier
                .size(96.dp)
                .background(
                    brush = Brush.linearGradient(listOf(NexosPrimary, NexosPrimaryGlow)),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Mic, contentDescription = null, tint = NexosBackground, modifier = Modifier.size(40.dp))
        }
    }
}
