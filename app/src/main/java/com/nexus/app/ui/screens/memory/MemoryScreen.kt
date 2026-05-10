package com.nexus.app.ui.screens.memory

import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.R
import com.nexus.app.ui.components.EmptyState
import com.nexus.app.ui.components.leather.LeatherButton
import com.nexus.app.ui.components.leather.LeatherCard
import com.nexus.app.ui.components.leather.StaggeredEntry
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette

@Composable
fun MemoryScreen(viewModel: MemoryViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val items by viewModel.preferences.collectAsStateWithLifecycle()
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.memory_title),
                        color = LeatherPalette.PandaIvory
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                stringResource(R.string.memory_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = LeatherPalette.PandaCream.copy(alpha = 0.85f)
            )
            OutlinedTextField(
                value = state.keyDraft,
                onValueChange = viewModel::onKeyChange,
                placeholder = { Text(stringResource(R.string.memory_key)) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = LeatherPalette.ThreadFresh,
                    unfocusedBorderColor = LeatherPalette.ThreadMoss,
                    cursorColor = LeatherPalette.ThreadFresh,
                    focusedTextColor = LeatherPalette.PandaIvory,
                    unfocusedTextColor = LeatherPalette.PandaCream
                ),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = state.valueDraft,
                onValueChange = viewModel::onValueChange,
                placeholder = { Text(stringResource(R.string.memory_value)) },
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = LeatherPalette.ThreadFresh,
                    unfocusedBorderColor = LeatherPalette.ThreadMoss,
                    cursorColor = LeatherPalette.ThreadFresh,
                    focusedTextColor = LeatherPalette.PandaIvory,
                    unfocusedTextColor = LeatherPalette.PandaCream
                ),
                modifier = Modifier.fillMaxWidth()
            )
            state.errorMessage?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            LeatherButton(text = stringResource(R.string.memory_save), onClick = viewModel::save)
            Spacer(Modifier.height(4.dp))
            if (items.isEmpty()) {
                EmptyState(
                    title = stringResource(R.string.common_empty),
                    body = stringResource(R.string.memory_empty)
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(items = items, key = { _, it -> it.key }) { index, pref ->
                        // Staggered fade-up entrance — each row offset by 60 ms,
                        // capped so a long list still finishes its enter
                        // choreography quickly. UI/UX skill §9.
                        StaggeredEntry(index = index) {
                            LeatherCard(
                                modifier = Modifier.fillMaxWidth(),
                                elevationLevel = 1,
                                contentPadding = 14.dp
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            pref.key,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = LeatherPalette.PandaIvory
                                        )
                                        Text(
                                            pref.value,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = LeatherPalette.PandaCream
                                        )
                                    }
                                    IconButton(onClick = { viewModel.delete(pref.key) }) {
                                        Icon(
                                            imageVector = Icons.Filled.Delete,
                                            contentDescription = "Delete ${pref.key}",
                                            tint = LeatherPalette.ErrorOxblood
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
