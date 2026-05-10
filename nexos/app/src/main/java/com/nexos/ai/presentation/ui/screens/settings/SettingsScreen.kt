package com.nexos.ai.presentation.ui.screens.settings

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexos.ai.presentation.ui.components.PrimaryButton
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.ui.theme.NexosOnSurface
import com.nexos.ai.presentation.ui.theme.NexosOnSurfaceMuted
import com.nexos.ai.presentation.ui.theme.NexosOutline
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.ui.theme.NexosSurfaceElevated
import com.nexos.ai.presentation.viewmodel.ProviderInfo
import com.nexos.ai.presentation.viewmodel.SettingsViewModel

@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val status by viewModel.statusMessage.collectAsStateWithLifecycle()

    val keyDrafts = remember { mutableStateMapOf<String, String>() }

    LaunchedEffect(status) {
        if (status != null) {
            kotlinx.coroutines.delay(2_000)
            viewModel.clearStatus()
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.systemBars)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TopBar(onBack) }
        item {
            SectionHeader("AI Provider")
            Text(
                text = "Pick which provider summarizes captured text. Keys never leave this device.",
                color = NexosOnSurfaceMuted,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
            )
        }
        items(state.providers, key = { it.key }) { p ->
            ProviderRow(
                provider = p,
                selected = state.activeProvider == p.key,
                onSelect = { viewModel.selectProvider(p.key) },
            )
        }
        item { Spacer(Modifier.height(8.dp)) }
        item { SectionHeader("API keys") }
        items(state.providers.filter { it.key != "none" }, key = { "key-${it.key}" }) { p ->
            ApiKeyRow(
                provider = p,
                draft = keyDrafts[p.key].orEmpty(),
                onDraftChange = { keyDrafts[p.key] = it },
                onSave = {
                    viewModel.saveApiKey(p.key, keyDrafts[p.key].orEmpty())
                    keyDrafts[p.key] = ""
                },
            )
        }
        item { Spacer(Modifier.height(12.dp)) }
        item { SectionHeader("Behaviour") }
        item {
            ToggleRow(
                title = "Auto-summarize with AI",
                subtitle = "Send captured text through your AI provider when one is configured.",
                value = state.autoSummarize,
                onChange = viewModel::setAutoSummarize,
            )
        }
        item {
            ToggleRow(
                title = "Auto-save notes",
                subtitle = "Save every captured note immediately. Disable for manual review.",
                value = state.autoSave,
                onChange = viewModel::setAutoSave,
            )
        }
        item {
            ToggleRow(
                title = "Show floating bubble",
                subtitle = "Persistent overlay for one-tap capture from anywhere.",
                value = state.showFloatingButton,
                onChange = viewModel::setShowFloatingButton,
            )
        }
        item {
            status?.let { msg ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(NexosPrimary.copy(alpha = 0.12f))
                        .border(1.dp, NexosPrimary.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                ) {
                    Text(msg, color = NexosOnSurface, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun TopBar(onBack: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(NexosSurfaceElevated)
                .border(1.dp, NexosOutline, CircleShape)
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = NexosOnSurface, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Text("Settings", color = NexosOnSurface, fontSize = 22.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SectionHeader(label: String) {
    Text(
        text = label.uppercase(),
        color = NexosOnSurfaceMuted,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun ProviderRow(
    provider: ProviderInfo,
    selected: Boolean,
    onSelect: () -> Unit,
) {
    val scale by animateFloatAsState(
        targetValue = if (selected) 1f else 0.99f,
        animationSpec = tween(NexosMotion.Slow, easing = NexosMotion.EaseSpring),
        label = "row-scale",
    )

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .scale(scale)
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) NexosPrimary.copy(alpha = 0.08f) else NexosSurface)
            .border(
                1.dp,
                if (selected) NexosPrimary.copy(alpha = 0.5f) else NexosOutline,
                RoundedCornerShape(14.dp),
            )
            .clickable(onClick = onSelect)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(provider.displayName, color = NexosOnSurface, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            Text(
                text = if (provider.key == "none") "No network calls"
                else if (provider.hasKey) "Key configured"
                else "Add a key to enable",
                color = NexosOnSurfaceMuted,
                fontSize = 12.sp,
            )
        }
        if (selected) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(NexosPrimary),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = androidx.compose.ui.graphics.Color(0xFF07070F), modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun ApiKeyRow(
    provider: ProviderInfo,
    draft: String,
    onDraftChange: (String) -> Unit,
    onSave: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(NexosSurface)
            .border(1.dp, NexosOutline, RoundedCornerShape(14.dp))
            .padding(16.dp),
    ) {
        Row {
            Text(provider.displayName, color = NexosOnSurface, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            if (provider.hasKey) {
                Text("Saved", color = NexosPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
        }
        Spacer(Modifier.height(10.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(NexosSurfaceElevated)
                .border(1.dp, NexosOutline, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 12.dp),
        ) {
            BasicTextField(
                value = draft,
                onValueChange = onDraftChange,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                textStyle = TextStyle(color = NexosOnSurface, fontSize = 13.sp),
                cursorBrush = SolidColor(NexosPrimary),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (draft.isEmpty()) Text("Paste your API key…", color = NexosOnSurfaceMuted, fontSize = 13.sp)
                    inner()
                },
            )
        }
        Spacer(Modifier.height(10.dp))
        PrimaryButton(
            text = if (draft.isBlank() && provider.hasKey) "Clear key" else "Save key",
            onClick = onSave,
            modifier = Modifier.fillMaxWidth(),
            enabled = draft.isNotBlank() || provider.hasKey,
        )
    }
}

@Composable
private fun ToggleRow(
    title: String,
    subtitle: String,
    value: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(NexosSurface)
            .border(1.dp, NexosOutline, RoundedCornerShape(14.dp))
            .clickable(onClick = { onChange(!value) })
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = NexosOnSurface, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(subtitle, color = NexosOnSurfaceMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        }
        Spacer(Modifier.width(12.dp))
        ToggleSwitch(value = value, onChange = onChange)
    }
}

@Composable
private fun ToggleSwitch(value: Boolean, onChange: (Boolean) -> Unit) {
    val track by animateFloatAsState(
        targetValue = if (value) 1f else 0f,
        animationSpec = tween(NexosMotion.Moderate, easing = NexosMotion.EaseSpring),
        label = "toggle",
    )
    Box(
        modifier = Modifier
            .size(width = 46.dp, height = 26.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(
                color = androidx.compose.ui.graphics.lerp(NexosOutline, NexosPrimary, track)
            )
            .clickable { onChange(!value) },
        contentAlignment = Alignment.CenterStart,
    ) {
        val knobOffset = (20 * track).dp
        Box(
            modifier = Modifier
                .padding(start = knobOffset + 3.dp, end = 3.dp)
                .size(20.dp)
                .clip(CircleShape)
                .background(androidx.compose.ui.graphics.Color.White),
        )
    }
}
