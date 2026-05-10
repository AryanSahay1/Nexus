package com.nexus.app.ui.screens.vault

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.R
import com.nexus.app.ui.components.leather.LeatherButton
import com.nexus.app.ui.components.leather.LeatherCard
import com.nexus.app.ui.components.leather.LeatherCardVariant
import com.nexus.app.ui.components.leather.OutlineLeatherButton
import com.nexus.app.ui.components.leather.StitchedCheck
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette

@Composable
fun VaultScreen(viewModel: VaultViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result -> viewModel.handleAuthResult(result.data) }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.vault_title),
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
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OpenAiCard(state, viewModel)
            GoogleCard(state, viewModel) { intent ->
                if (intent != null) launcher.launch(intent)
            }
            AnimatedVisibility(
                visible = state.errorMessage != null,
                enter = fadeIn(LeatherMotion.tweenLeather(LeatherMotion.Normal)) +
                    slideInVertically(
                        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
                        initialOffsetY = { it / 4 }
                    ),
                exit = fadeOut(LeatherMotion.tweenLeather(LeatherMotion.Fast)) +
                    slideOutVertically(
                        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Fast)
                    )
            ) {
                state.errorMessage?.let { msg ->
                    LeatherCard(
                        modifier = Modifier.fillMaxWidth(),
                        variant = LeatherCardVariant.Error,
                        elevationLevel = 1,
                        contentPadding = 14.dp
                    ) {
                        Text(
                            text = msg,
                            color = LeatherPalette.PandaIvory,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun OpenAiCard(state: VaultUiState, vm: VaultViewModel) {
    var keyInput by rememberSaveable { mutableStateOf("") }
    val variant = if (state.openAiConnected) LeatherCardVariant.Highlight
    else LeatherCardVariant.Standard

    LeatherCard(
        modifier = Modifier.fillMaxWidth(),
        variant = variant,
        elevationLevel = 2,
        grainSeed = 11
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            if (state.openAiConnected) {
                StitchedCheck(modifier = Modifier.align(Alignment.TopEnd))
            }
            Column {
                Text(
                    text = stringResource(R.string.vault_openai),
                    style = MaterialTheme.typography.headlineMedium,
                    color = LeatherPalette.PandaIvory
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = when {
                        state.openAiConnected ->
                            "${stringResource(R.string.vault_connected)} • ${state.openAiKeyMasked ?: "—"}"
                        state.isAssistiveOnly ->
                            "Assistive Mode — Learn tab works, AI Chat needs a key"
                        else -> stringResource(R.string.vault_disconnected)
                    },
                    color = LeatherPalette.PandaCream,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = keyInput,
                    onValueChange = { keyInput = it },
                    placeholder = { Text(stringResource(R.string.api_key_hint)) },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
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
                Spacer(Modifier.height(12.dp))
                LeatherButton(
                    text = if (state.openAiConnected) "Replace key" else stringResource(R.string.vault_connect),
                    onClick = {
                        val k = keyInput.trim()
                        if (k.startsWith("sk-")) {
                            vm.replaceOpenAiKey(k)
                            keyInput = ""
                        }
                    },
                    enabled = keyInput.startsWith("sk-")
                )
                if (state.openAiConnected) {
                    Spacer(Modifier.height(8.dp))
                    OutlineLeatherButton(
                        text = stringResource(R.string.vault_disconnect),
                        onClick = vm::disconnectOpenAi
                    )
                }
            }
        }
    }
}

@Composable
private fun GoogleCard(
    state: VaultUiState,
    vm: VaultViewModel,
    onConnect: (android.content.Intent?) -> Unit
) {
    val variant = if (state.googleConnected) LeatherCardVariant.Highlight
    else LeatherCardVariant.Standard

    LeatherCard(
        modifier = Modifier.fillMaxWidth(),
        variant = variant,
        elevationLevel = 2,
        grainSeed = 22
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            if (state.googleConnected) {
                StitchedCheck(modifier = Modifier.align(Alignment.TopEnd))
            }
            Column {
                Text(
                    text = stringResource(R.string.vault_google),
                    style = MaterialTheme.typography.headlineMedium,
                    color = LeatherPalette.PandaIvory
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = if (state.googleConnected)
                        "${stringResource(R.string.vault_connected)} • ${state.googleEmail ?: "—"}"
                    else stringResource(R.string.vault_disconnected),
                    color = LeatherPalette.PandaCream,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = state.googleClientId,
                    onValueChange = vm::setGoogleClientId,
                    placeholder = { Text("xxxxx.apps.googleusercontent.com") },
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
                Spacer(Modifier.height(12.dp))
                if (state.googleConnected) {
                    OutlineLeatherButton(
                        text = stringResource(R.string.vault_disconnect),
                        onClick = vm::disconnectGoogle
                    )
                } else {
                    LeatherButton(
                        text = stringResource(R.string.vault_connect),
                        onClick = { onConnect(vm.buildGoogleAuthIntent()) },
                        loading = state.isWorking,
                        enabled = state.googleClientId.isNotBlank()
                    )
                }
            }
        }
    }
}
