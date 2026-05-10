package com.nexos.ai.presentation.ui.screens.notes

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexos.ai.presentation.ui.components.NoteCard
import com.nexos.ai.presentation.ui.components.PrimaryButton
import com.nexos.ai.presentation.ui.components.SkeletonCard
import com.nexos.ai.presentation.ui.components.WorkflowToast
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.ui.theme.NexosOnSurface
import com.nexos.ai.presentation.ui.theme.NexosOnSurfaceMuted
import com.nexos.ai.presentation.ui.theme.NexosOutline
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.ui.theme.NexosSurfaceElevated
import com.nexos.ai.presentation.viewmodel.NotesViewModel

@Composable
fun NoteListScreen(
    viewModel: NotesViewModel,
    onNoteClick: (Long) -> Unit,
    onSettingsClick: () -> Unit,
    onCaptureClick: () -> Unit,
    onToggleFloating: () -> Unit,
    autoOpenVoice: Boolean,
    onVoiceConsumed: () -> Unit,
) {
    val notes by viewModel.filteredNotes.collectAsStateWithLifecycle()
    val workflowState by viewModel.workflowState.collectAsStateWithLifecycle()
    val query by viewModel.searchQuery.collectAsState()

    var manualOpen by remember { mutableStateOf(false) }
    var voiceOpen by remember { mutableStateOf(false) }

    LaunchedEffect(autoOpenVoice) {
        if (autoOpenVoice) {
            voiceOpen = true
            onVoiceConsumed()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.systemBars),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
        ) {
            TopBar(onSettingsClick = onSettingsClick, onToggleFloating = onToggleFloating)
            Spacer(Modifier.height(8.dp))
            HeroHeader(noteCount = notes.size)
            Spacer(Modifier.height(16.dp))
            SearchField(query = query, onQueryChange = viewModel::onSearchQueryChange)
            Spacer(Modifier.height(12.dp))
            QuickActionRow(
                onCaptureClick = onCaptureClick,
                onVoiceClick = { voiceOpen = true },
                onManualClick = { manualOpen = true },
            )
            Spacer(Modifier.height(8.dp))
            WorkflowToast(state = workflowState)
            Spacer(Modifier.height(8.dp))

            NotesContent(notes = notes, onNoteClick = onNoteClick)
        }
    }

    if (manualOpen) {
        ManualNoteSheet(
            onSave = { title, content ->
                viewModel.saveManualNote(title, content)
                manualOpen = false
            },
            onDismiss = { manualOpen = false },
        )
    }

    if (voiceOpen) {
        VoiceInputSheet(
            viewModel = viewModel,
            onDismiss = { voiceOpen = false },
        )
    }
}

@Composable
private fun TopBar(onSettingsClick: () -> Unit, onToggleFloating: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(NexosPrimary, Color(0xFF4DA6FF)),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text("N", color = Color(0xFF07070F), fontWeight = FontWeight.Black, fontSize = 18.sp)
        }
        Spacer(Modifier.width(10.dp))
        Text("NexOS", color = NexosOnSurface, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        Spacer(Modifier.weight(1f))
        IconChip(icon = Icons.Outlined.Settings, contentDescription = "Floating button toggle", onClick = onToggleFloating, tint = NexosPrimary)
        Spacer(Modifier.width(8.dp))
        IconChip(icon = Icons.Outlined.Settings, contentDescription = "Settings", onClick = onSettingsClick)
    }
}

@Composable
private fun IconChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    tint: Color = NexosOnSurface,
) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(NexosSurfaceElevated)
            .border(1.dp, NexosOutline, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(imageVector = icon, contentDescription = contentDescription, tint = tint, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun HeroHeader(noteCount: Int) {
    Column(modifier = Modifier.padding(top = 16.dp)) {
        Text(
            text = "Capture. Speak.\nLet AI shape it.",
            color = NexosOnSurface,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 34.sp,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = if (noteCount == 0) "Your private notebook starts empty."
            else "$noteCount note${if (noteCount == 1) "" else "s"} stored locally on this device.",
            color = NexosOnSurfaceMuted,
            fontSize = 14.sp,
        )
    }
}

@Composable
private fun SearchField(query: String, onQueryChange: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(NexosSurface)
            .border(1.dp, NexosOutline, RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Outlined.Search,
            contentDescription = "Search",
            tint = NexosOnSurfaceMuted,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(10.dp))
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(color = NexosOnSurface, fontSize = 14.sp),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(NexosPrimary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                if (query.isEmpty()) {
                    Text("Search notes…", color = NexosOnSurfaceMuted, fontSize = 14.sp)
                }
                inner()
            },
        )
    }
}

@Composable
private fun QuickActionRow(
    onCaptureClick: () -> Unit,
    onVoiceClick: () -> Unit,
    onManualClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        QuickActionTile(
            icon = Icons.Outlined.CameraAlt,
            label = "Screenshot",
            modifier = Modifier.weight(1f),
            onClick = onCaptureClick,
        )
        QuickActionTile(
            icon = Icons.Filled.Mic,
            label = "Voice",
            modifier = Modifier.weight(1f),
            onClick = onVoiceClick,
        )
        QuickActionTile(
            icon = Icons.Filled.Add,
            label = "New",
            modifier = Modifier.weight(1f),
            onClick = onManualClick,
        )
    }
}

@Composable
private fun QuickActionTile(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(NexosSurface, NexosSurfaceElevated),
                ),
            )
            .border(1.dp, NexosOutline, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(NexosPrimary.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = label, tint = NexosPrimary, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.height(8.dp))
        Text(label, color = NexosOnSurface, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun NotesContent(
    notes: List<com.nexos.ai.domain.model.Note>,
    onNoteClick: (Long) -> Unit,
) {
    if (notes.isEmpty()) {
        EmptyState()
    } else {
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(vertical = 8.dp),
        ) {
            items(notes, key = { it.id }) { note ->
                NoteCard(note = note, onClick = { onNoteClick(note.id) })
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(NexosPrimary.copy(alpha = 0.08f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.StickyNote2,
                contentDescription = null,
                tint = NexosPrimary,
                modifier = Modifier.size(40.dp),
            )
        }
        Spacer(Modifier.height(16.dp))
        Text("Nothing here yet", color = NexosOnSurface, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(
            "Tap Screenshot, Voice, or New to create your first note.",
            color = NexosOnSurfaceMuted,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.78f),
        )
        Spacer(Modifier.height(24.dp))
        SkeletonCard(modifier = Modifier.padding(horizontal = 24.dp))
    }
}

// ---- Manual note bottom sheet ----
@Composable
private fun ManualNoteSheet(
    onSave: (title: String, content: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }

    BottomSheetScrim(onDismiss = onDismiss) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text("New note", color = NexosOnSurface, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(16.dp))
            SheetTextField(value = title, onValueChange = { title = it }, placeholder = "Title")
            Spacer(Modifier.height(12.dp))
            SheetTextField(value = content, onValueChange = { content = it }, placeholder = "Write something…", multiLine = true)
            Spacer(Modifier.height(20.dp))
            PrimaryButton(text = "Save note", onClick = { onSave(title, content) }, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun VoiceInputSheet(
    viewModel: NotesViewModel,
    onDismiss: () -> Unit,
) {
    val voiceState by viewModel.orchestrator.voiceState.collectAsStateWithLifecycle()

    BottomSheetScrim(onDismiss = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(NexosPrimary.copy(alpha = 0.20f)),
                contentAlignment = Alignment.Center,
            ) {
                com.nexos.ai.presentation.ui.components.PulsingDot(color = NexosPrimary, sizeDp = 32)
            }
            Spacer(Modifier.height(20.dp))
            val text = when (val s = voiceState) {
                com.nexos.ai.voice.VoiceInputManager.State.Idle -> "Tap start and speak."
                com.nexos.ai.voice.VoiceInputManager.State.Listening -> "Listening…"
                is com.nexos.ai.voice.VoiceInputManager.State.Partial -> s.text
                is com.nexos.ai.voice.VoiceInputManager.State.Result -> s.text
                is com.nexos.ai.voice.VoiceInputManager.State.Failed -> "Error: ${s.error}"
            }
            Text(text, color = NexosOnSurface, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                com.nexos.ai.presentation.ui.components.GhostButton(text = "Close", onClick = onDismiss)
                PrimaryButton(text = "Start", onClick = { viewModel.startVoice() })
            }
        }
    }
}

@Composable
private fun BottomSheetScrim(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    AnimatedVisibility(
        visible = true,
        enter = fadeIn(tween(NexosMotion.Slow)),
        exit = fadeOut(tween(NexosMotion.Normal)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.55f))
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.BottomCenter,
        ) {
            AnimatedVisibility(
                visible = true,
                enter = slideInVertically(NexosMotion.tweenSpringy(NexosMotion.Slow)) { it } +
                    fadeIn(tween(NexosMotion.Slow)),
                exit = slideOutVertically(tween(NexosMotion.Normal)) { it } +
                    fadeOut(tween(NexosMotion.Normal)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                        .background(NexosSurface)
                        .border(
                            1.dp,
                            NexosOutline,
                            RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                        )
                        .clickable(enabled = false) {},
                ) { content() }
            }
        }
    }
}

@Composable
private fun SheetTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    multiLine: Boolean = false,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(NexosSurfaceElevated)
            .border(1.dp, NexosOutline, RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = !multiLine,
            textStyle = TextStyle(color = NexosOnSurface, fontSize = 14.sp),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(NexosPrimary),
            modifier = Modifier.fillMaxWidth().padding(vertical = if (multiLine) 6.dp else 0.dp),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(placeholder, color = NexosOnSurfaceMuted, fontSize = 14.sp)
                }
                inner()
            },
        )
    }
}

