package com.nexus.app.ui.screens.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.R
import com.nexus.app.domain.agent.AgentStatus
import com.nexus.app.domain.agent.PendingAction
import com.nexus.app.domain.agent.UiMessage
import com.nexus.app.ui.components.leather.LeatherButton
import com.nexus.app.ui.components.leather.LeatherCard
import com.nexus.app.ui.components.leather.LeatherCardVariant
import com.nexus.app.ui.components.leather.OutlineLeatherButton
import com.nexus.app.ui.components.leather.ThinkingDots
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.LeatherTone
import com.nexus.app.ui.theme.leather.leatherSurface
import com.nexus.app.ui.theme.leather.stitchedBorder
import kotlinx.coroutines.delay

@Composable
fun ChatScreen(viewModel: ChatViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.chat_title),
                        color = LeatherPalette.PandaIvory
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        }
    ) { padding ->
        ChatContent(
            state = state,
            onMessageChange = viewModel::onInputChange,
            onSend = viewModel::sendMessage,
            onConfirm = viewModel::confirmAction,
            onCancel = viewModel::cancelAction,
            modifier = Modifier.padding(padding)
        )
    }
}

@Composable
private fun ChatContent(
    state: ChatUiState,
    onMessageChange: (String) -> Unit,
    onSend: () -> Unit,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxSize()) {
        val listState = rememberLazyListState()
        LaunchedEffect(state.messages.size) {
            if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.lastIndex)
        }
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(items = state.messages, key = { it.id }) { message ->
                MessageBubble(message)
            }
            if (state.status == AgentStatus.PROCESSING_INTENT) {
                item("typing") { TypingBubble() }
            }
            if (state.status == AgentStatus.EXECUTING_TOOL && state.activeToolName != null) {
                item("tool-${state.activeToolName}") { ToolBadge(state.activeToolName) }
            }
            state.pendingAction?.let { action ->
                item("confirm-${action.toolCallId}") {
                    ConfirmationCard(
                        action = action,
                        onConfirm = onConfirm,
                        onCancel = onCancel
                    )
                }
            }
        }
        ChatInputBar(
            text = state.input,
            onTextChange = onMessageChange,
            onSend = onSend,
            enabled = state.canSend,
            errorMessage = state.errorMessage,
            sending = state.status == AgentStatus.PROCESSING_INTENT
        )
    }
}

@Composable
private fun MessageBubble(message: UiMessage) {
    val isUser = message.role == "user"
    val alignment = if (isUser) Alignment.End else Alignment.Start
    val tone = if (isUser) LeatherTone.Saddle else LeatherTone.Tobacco
    val stitchVariant = if (isUser) LeatherCardVariant.Highlight else LeatherCardVariant.Standard

    AnimatedVisibility(
        visible = true,
        enter = slideInVertically(
            initialOffsetY = { it / 3 },
            animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal)
        ) + fadeIn(LeatherMotion.tweenLeather(LeatherMotion.Normal))
    ) {
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = alignment) {
            LeatherCard(
                modifier = Modifier.widthIn(max = 320.dp),
                tone = tone,
                variant = stitchVariant,
                elevationLevel = 1,
                cornerRadius = 18.dp,
                contentPadding = 14.dp,
                grainSeed = message.id.toInt()
            ) {
                Text(
                    text = message.text,
                    style = MaterialTheme.typography.bodyLarge,
                    color = LeatherPalette.PandaIvory
                )
            }
        }
    }
}

@Composable
private fun TypingBubble() {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
        LeatherCard(
            modifier = Modifier.widthIn(max = 200.dp),
            elevationLevel = 1,
            cornerRadius = 18.dp,
            contentPadding = 14.dp
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ThinkingDots()
                Spacer(Modifier.width(10.dp))
                Text(
                    text = stringResource(R.string.chat_thinking),
                    style = MaterialTheme.typography.bodyMedium,
                    color = LeatherPalette.PandaCream
                )
            }
        }
    }
}

@Composable
private fun ToolBadge(toolName: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
        LeatherCard(
            modifier = Modifier.widthIn(max = 280.dp),
            variant = LeatherCardVariant.Highlight,
            elevationLevel = 1,
            cornerRadius = 18.dp,
            contentPadding = 14.dp
        ) {
            Text(
                text = stringResource(R.string.chat_executing, toolName),
                style = MaterialTheme.typography.bodyMedium,
                color = LeatherPalette.PandaIvory
            )
        }
    }
}

@Composable
private fun ConfirmationCard(
    action: PendingAction,
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    // Spring scale-in on first composition. We also gate the Confirm
    // button for 200 ms after the card appears so an accidental
    // tap-through can't fire the destructive action.
    var armed by remember { mutableStateOf(false) }
    LaunchedEffect(action.toolCallId) {
        armed = false
        delay(200)
        armed = true
    }

    AnimatedVisibility(
        visible = true,
        enter = scaleIn(
            initialScale = 0.92f,
            animationSpec = LeatherMotion.springLeather()
        ) + fadeIn(LeatherMotion.tweenLeather(LeatherMotion.Slow)),
        exit = scaleOut(animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal)) +
            fadeOut(LeatherMotion.tweenLeather(LeatherMotion.Normal))
    ) {
        LeatherCard(
            modifier = Modifier.fillMaxWidth(),
            variant = LeatherCardVariant.Warning,
            elevationLevel = 3,
            grainSeed = action.toolCallId.hashCode()
        ) {
            Column {
                Text(
                    text = action.summary,
                    style = MaterialTheme.typography.headlineMedium,
                    color = LeatherPalette.PandaIvory
                )
                if (action.detail.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = action.detail,
                        style = MaterialTheme.typography.bodyMedium,
                        color = LeatherPalette.PandaCream
                    )
                }
                Spacer(Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(modifier = Modifier.weight(1f)) {
                        OutlineLeatherButton(
                            text = stringResource(R.string.chat_cancel),
                            onClick = onCancel
                        )
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        LeatherButton(
                            text = stringResource(R.string.chat_confirm),
                            onClick = onConfirm,
                            enabled = armed
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatInputBar(
    text: String,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    enabled: Boolean,
    errorMessage: String?,
    sending: Boolean
) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
        if (errorMessage != null) {
            Text(
                text = errorMessage,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .leatherSurface(LeatherTone.Tobacco, cornerRadius = 18.dp)
                .stitchedBorder(thread = LeatherPalette.ThreadMoss, cornerRadius = 12.dp)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = text,
                onValueChange = onTextChange,
                placeholder = {
                    Text(
                        stringResource(R.string.chat_input_hint),
                        color = LeatherPalette.PandaCream.copy(alpha = 0.6f)
                    )
                },
                modifier = Modifier.weight(1f),
                singleLine = false,
                maxLines = 5,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    cursorColor = LeatherPalette.ThreadFresh,
                    focusedTextColor = LeatherPalette.PandaIvory,
                    unfocusedTextColor = LeatherPalette.PandaCream,
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent
                ),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send)
            )
            SendButton(
                enabled = enabled && text.isNotBlank(),
                sending = sending,
                onClick = onSend
            )
        }
    }
}

@Composable
private fun SendButton(enabled: Boolean, sending: Boolean, onClick: () -> Unit) {
    // Pulse the icon while a turn is in flight — purely visual feedback so
    // the user knows the agent is working even if no tokens have streamed
    // back yet.
    val infinite = rememberInfiniteTransition(label = "sendPulse")
    val pulse by infinite.animateFloat(
        initialValue = 1f,
        targetValue = if (sending) 1.08f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 600, easing = LeatherMotion.EaseOutLeather),
            repeatMode = RepeatMode.Reverse
        ),
        label = "sendPulseScale"
    )
    val tint by animateFloatAsState(
        targetValue = if (enabled) 1f else 0.4f,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Fast),
        label = "sendTint"
    )
    IconButton(onClick = onClick, enabled = enabled, modifier = Modifier.size(48.dp)) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.Send,
            contentDescription = stringResource(R.string.chat_send),
            tint = LeatherPalette.ThreadFresh.copy(alpha = tint),
            modifier = Modifier.scale(pulse)
        )
    }
}
