package com.nexos.ai.presentation.ui.notes

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexos.ai.R
import com.nexos.ai.domain.model.WorkflowState
import com.nexos.ai.presentation.ui.components.CapsuleProgressIndicator
import com.nexos.ai.presentation.ui.components.EmptyNotesView
import com.nexos.ai.presentation.ui.components.NoteCard
import com.nexos.ai.presentation.ui.theme.NexosBackground
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.viewmodel.NotesViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteListScreen(
    viewModel: NotesViewModel = hiltViewModel(),
    onNoteClick: (Long) -> Unit,
    onSettingsClick: () -> Unit
) {
    val query     by viewModel.query.collectAsStateWithLifecycle()
    val notes     by viewModel.filteredNotes.collectAsStateWithLifecycle()
    val workflow  by viewModel.workflow.collectAsStateWithLifecycle()

    val listState = rememberLazyListState()
    val isAtTop by remember { derivedStateOf { listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset < 8 } }
    val headerAlpha by animateFloatAsState(
        targetValue = if (isAtTop) 1f else 0.85f, animationSpec = NexosMotion.moderate(), label = "headerAlpha"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .background(
                                    brush = Brush.linearGradient(listOf(NexosPrimary, Color(0xFF4DA6FF))),
                                    shape = RoundedCornerShape(8.dp)
                                )
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(stringResource(R.string.app_name), style = MaterialTheme.typography.titleLarge)
                    }
                },
                actions = {
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.screen_settings))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = NexosBackground,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                ),
                modifier = Modifier.graphicsLayer { alpha = headerAlpha }
            )
        },
        containerColor = NexosBackground
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {

            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                item("search") {
                    SearchField(
                        value = query,
                        onValueChange = viewModel::onQueryChange
                    )
                }

                if (notes.isEmpty()) {
                    item("empty") {
                        EmptyNotesView(
                            title = stringResource(R.string.empty_notes_title),
                            body  = stringResource(R.string.empty_notes_body),
                            modifier = Modifier.fillMaxWidth().padding(top = 48.dp)
                        )
                    }
                } else {
                    items(notes, key = { it.id }) { note ->
                        NoteCard(
                            note = note,
                            onClick = { onNoteClick(note.id) },
                            enterDelayMillis = (notes.indexOf(note).coerceIn(0, 6)) * NexosMotion.StaggerStep
                        )
                    }
                }
            }

            // Workflow chip floats over the list.
            AnimatedVisibility(
                visible  = workflow !is WorkflowState.Idle && !workflow.isTerminal,
                enter    = fadeIn(NexosMotion.normal()) + androidx.compose.animation.slideInVertically(
                              NexosMotion.bouncy()) { it },
                exit     = fadeOut(NexosMotion.exit()) + androidx.compose.animation.slideOutVertically(
                              NexosMotion.exit()) { it },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp)
            ) {
                CapsuleProgressIndicator(text = workflow.describe())
            }
        }
    }
}

private fun WorkflowState.describe(): String = when (this) {
    WorkflowState.Idle           -> "Idle"
    WorkflowState.Capturing      -> "Capturing screen"
    WorkflowState.ExtractingText -> "Reading text"
    WorkflowState.AiProcessing   -> "Asking the AI"
    WorkflowState.Saving         -> "Saving note"
    is WorkflowState.Done        -> "Saved"
    is WorkflowState.Failed      -> "Failed — $error"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchField(
    value: String,
    onValueChange: (String) -> Unit
) {
    Surface(
        shape  = RoundedCornerShape(16.dp),
        color  = NexosSurface,
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
    ) {
        TextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            placeholder = { Text(stringResource(R.string.search_notes_hint)) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            colors = TextFieldDefaults.colors(
                focusedContainerColor   = NexosSurface,
                unfocusedContainerColor = NexosSurface,
                focusedIndicatorColor   = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                disabledIndicatorColor  = Color.Transparent,
            ),
            modifier = Modifier.fillMaxWidth().height(56.dp)
        )
    }
}
