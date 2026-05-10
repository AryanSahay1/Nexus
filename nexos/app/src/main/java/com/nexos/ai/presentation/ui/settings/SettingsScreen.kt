package com.nexos.ai.presentation.ui.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexos.ai.R
import com.nexos.ai.domain.model.AiProviderKey
import com.nexos.ai.domain.model.FloatingButtonSide
import com.nexos.ai.presentation.ui.theme.NexosBackground
import com.nexos.ai.presentation.ui.theme.NexosError
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSuccess
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.viewmodel.SettingsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBack: () -> Unit
) {
    val settings   by viewModel.settings.collectAsStateWithLifecycle()
    val masked     by viewModel.maskedKeys.collectAsStateWithLifecycle()
    val testResult by viewModel.testResult.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.screen_settings)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NexosBackground)
            )
        },
        containerColor = NexosBackground
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(
                top    = padding.calculateTopPadding() + 8.dp,
                bottom = padding.calculateBottomPadding() + 24.dp,
                start  = 16.dp,
                end    = 16.dp
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item("provider") {
                Section(title = stringResource(R.string.settings_ai_provider),
                        subtitle = stringResource(R.string.settings_ai_provider_summary)) {
                    Column {
                        AiProviderKey.values().forEach { provider ->
                            ProviderRow(
                                provider = provider,
                                selected = settings.provider == provider,
                                maskedKey = masked[provider].orEmpty(),
                                testResult = (testResult as? SettingsViewModel.TestResult)
                                    ?.takeIf { it.provider == provider },
                                onSelect = { viewModel.setProvider(provider) },
                                onSaveKey = { viewModel.saveApiKey(provider, it) },
                                onTest = { viewModel.testConnection(provider) }
                            )
                        }
                    }
                }
            }

            item("workflow") {
                Section("Workflow") {
                    Column {
                        ToggleRow(
                            label = stringResource(R.string.settings_auto_summarize),
                            checked = settings.autoSummarize,
                            onCheckedChange = viewModel::setAutoSummarize
                        )
                        ToggleRow(
                            label = stringResource(R.string.settings_auto_save),
                            checked = settings.autoSave,
                            onCheckedChange = viewModel::setAutoSave
                        )
                    }
                }
            }

            item("floating") {
                Section("Floating button") {
                    Column {
                        ToggleRow(
                            label = stringResource(R.string.settings_floating_button),
                            checked = settings.showFloatingButton,
                            onCheckedChange = viewModel::setShowFloatingButton
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            stringResource(R.string.settings_floating_button_side),
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(start = 16.dp, top = 8.dp, bottom = 4.dp)
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            SegmentedChip(
                                text = "Left",
                                selected = settings.floatingSide == FloatingButtonSide.LEFT,
                                onClick = { viewModel.setFloatingSide(FloatingButtonSide.LEFT) },
                                modifier = Modifier.weight(1f)
                            )
                            SegmentedChip(
                                text = "Right",
                                selected = settings.floatingSide == FloatingButtonSide.RIGHT,
                                onClick = { viewModel.setFloatingSide(FloatingButtonSide.RIGHT) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            item("about") {
                Section(stringResource(R.string.settings_about)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("NexOS 1.0.0", style = MaterialTheme.typography.titleSmall)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "All notes and API keys live on this device. Nothing leaves your phone except the literal payload of the API call you authorize.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Section(
    title: String,
    subtitle: String? = null,
    content: @Composable () -> Unit
) {
    Column {
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 4.dp, top = 12.dp, bottom = 6.dp)
        )
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, bottom = 10.dp)
            )
        }
        Surface(
            color = NexosSurface,
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.fillMaxWidth()
        ) { content() }
    }
}

@Composable
private fun ToggleRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor   = NexosPrimary,
                checkedTrackColor   = NexosPrimary.copy(alpha = 0.35f),
                uncheckedThumbColor = MaterialTheme.colorScheme.onSurfaceVariant,
                uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant
            )
        )
    }
}

@Composable
private fun SegmentedChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val borderColor = if (selected) NexosPrimary else MaterialTheme.colorScheme.outlineVariant
    val textColor   = if (selected) NexosPrimary else MaterialTheme.colorScheme.onSurfaceVariant
    Surface(
        shape = RoundedCornerShape(50),
        color = if (selected) NexosPrimary.copy(alpha = 0.12f) else Color.Transparent,
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor),
        modifier = modifier.height(40.dp).clickable { onClick() }
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Text(text, color = textColor, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun ProviderRow(
    provider: AiProviderKey,
    selected: Boolean,
    maskedKey: String,
    testResult: SettingsViewModel.TestResult?,
    onSelect: () -> Unit,
    onSaveKey: (String) -> Unit,
    onTest: () -> Unit
) {
    var expanded by rememberSaveable(provider) { mutableStateOf(false) }
    var keyDraft by rememberSaveable(provider) { mutableStateOf("") }
    var revealed by rememberSaveable(provider) { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onSelect(); if (provider != AiProviderKey.NONE) expanded = !expanded }
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .background(if (selected) NexosPrimary else Color.Transparent, shape = CircleShape)
                    .padding(2.dp)
            ) {
                if (selected) {
                    Box(
                        Modifier
                            .size(14.dp)
                            .background(NexosBackground, shape = CircleShape)
                            .align(Alignment.Center)
                    )
                }
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(provider.displayName, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
                if (provider != AiProviderKey.NONE && maskedKey.isNotEmpty()) {
                    Text(maskedKey, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else if (provider == AiProviderKey.NONE) {
                    Text("Runs entirely on-device; no API calls.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        AnimatedVisibility(
            visible = provider != AiProviderKey.NONE && expanded,
            enter   = fadeIn() + expandVertically(),
            exit    = fadeOut() + shrinkVertically()
        ) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                OutlinedTextField(
                    value = keyDraft,
                    onValueChange = { keyDraft = it },
                    label = { Text(stringResource(R.string.settings_api_key)) },
                    placeholder = { Text(stringResource(R.string.settings_api_key_hint)) },
                    singleLine = true,
                    visualTransformation = if (revealed) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { revealed = !revealed }) {
                            Icon(
                                if (revealed) Icons.Default.Close else Icons.Default.Check,
                                contentDescription = null
                            )
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor   = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            onSaveKey(keyDraft)
                            keyDraft = ""
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = NexosPrimary, contentColor = NexosBackground),
                        modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.action_save)) }
                    OutlinedButton(
                        onClick = onTest,
                        modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.settings_test_key)) }
                }
                AnimatedVisibility(
                    visible = testResult != null,
                    enter   = fadeIn(),
                    exit    = fadeOut()
                ) {
                    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        when (testResult) {
                            is SettingsViewModel.TestResult.Pending -> {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 1.5.dp, color = NexosPrimary)
                                Spacer(Modifier.width(8.dp)); Text("Testing…", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            is SettingsViewModel.TestResult.Success ->
                                Text("✓ Connected", style = MaterialTheme.typography.labelMedium, color = NexosSuccess)
                            is SettingsViewModel.TestResult.Failure ->
                                Text("✗ Connection failed", style = MaterialTheme.typography.labelMedium, color = NexosError)
                            null -> Unit
                        }
                    }
                }
            }
        }
    }
}
