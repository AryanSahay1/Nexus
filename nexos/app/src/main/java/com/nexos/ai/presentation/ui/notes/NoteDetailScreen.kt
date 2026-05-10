package com.nexos.ai.presentation.ui.notes

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexos.ai.R
import com.nexos.ai.presentation.ui.components.SourceBadge
import com.nexos.ai.presentation.ui.theme.NexosBackground
import com.nexos.ai.presentation.viewmodel.NoteDetailViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteDetailScreen(
    viewModel: NoteDetailViewModel = hiltViewModel(),
    onBack: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    var titleField   by rememberSaveable(state.note?.id) { mutableStateOf(state.note?.title.orEmpty()) }
    var contentField by rememberSaveable(state.note?.id) { mutableStateOf(state.note?.content.orEmpty()) }

    LaunchedEffect(state.note?.id) {
        state.note?.let {
            titleField = it.title
            contentField = it.content
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.note?.title?.take(40) ?: "Note") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
                actions = {
                    AnimatedContent(
                        targetState = state.isEditing,
                        label = "edit-toggle",
                        transitionSpec = { fadeIn() togetherWith fadeOut() }
                    ) { editing ->
                        if (editing) {
                            IconButton(onClick = { viewModel.save(titleField, contentField) }) {
                                Icon(Icons.Default.Done, contentDescription = stringResource(R.string.action_save))
                            }
                        } else {
                            IconButton(onClick = { viewModel.toggleEdit() }) {
                                Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.action_edit))
                            }
                        }
                    }
                    IconButton(onClick = { viewModel.delete(onBack) }) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = stringResource(R.string.action_delete),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NexosBackground)
            )
        },
        containerColor = NexosBackground
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            state.note?.let { n ->
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Row {
                        SourceBadge(sourceType = n.sourceType)
                    }
                    Spacer(Modifier.height(12.dp))
                    AnimatedContent(
                        targetState = state.isEditing,
                        label = "edit-content",
                        transitionSpec = { fadeIn() togetherWith fadeOut() }
                    ) { editing ->
                        if (editing) {
                            Column {
                                OutlinedTextField(
                                    value = titleField,
                                    onValueChange = { titleField = it },
                                    label = { Text("Title") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = TextFieldDefaults.colors(
                                        focusedContainerColor   = Color.Transparent,
                                        unfocusedContainerColor = Color.Transparent
                                    )
                                )
                                Spacer(Modifier.height(12.dp))
                                OutlinedTextField(
                                    value = contentField,
                                    onValueChange = { contentField = it },
                                    label = { Text("Content") },
                                    minLines = 8,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = TextFieldDefaults.colors(
                                        focusedContainerColor   = Color.Transparent,
                                        unfocusedContainerColor = Color.Transparent
                                    )
                                )
                            }
                        } else {
                            Column {
                                Text(
                                    n.title,
                                    style = MaterialTheme.typography.headlineSmall,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                if (n.summary.isNotBlank()) {
                                    Spacer(Modifier.height(10.dp))
                                    Text(
                                        n.summary,
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Spacer(Modifier.height(16.dp))
                                Text(
                                    n.content,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(96.dp))
                }
            }
            if (state.error != null && state.note == null) {
                Text(
                    state.error.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(24.dp)
                )
            }
        }
    }
}
