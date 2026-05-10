package com.nexus.app.ui.screens.vault

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.R
import com.nexus.app.ui.components.PrimaryButton

@Composable
fun VaultScreen(viewModel: VaultViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        viewModel.handleAuthResult(result.data)
    }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.vault_title)) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OpenAiCard(state, viewModel)
            GoogleCard(state, viewModel, onConnect = { intent ->
                if (intent != null) launcher.launch(intent)
            })
            state.errorMessage?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

@Composable
private fun OpenAiCard(state: VaultUiState, vm: VaultViewModel) {
    var keyInput by rememberSaveable { mutableStateOf("") }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(R.string.vault_openai),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
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
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(12.dp))
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
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            PrimaryButton(
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
                OutlinedButton(
                    onClick = { vm.disconnectOpenAi() },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.vault_disconnect)) }
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(R.string.vault_google),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = if (state.googleConnected)
                    "${stringResource(R.string.vault_connected)} • ${state.googleEmail ?: "—"}"
                else stringResource(R.string.vault_disconnected),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = state.googleClientId,
                onValueChange = vm::setGoogleClientId,
                placeholder = { Text("xxxxx.apps.googleusercontent.com") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            if (state.googleConnected) {
                OutlinedButton(
                    onClick = { vm.disconnectGoogle() },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.vault_disconnect)) }
            } else {
                PrimaryButton(
                    text = stringResource(R.string.vault_connect),
                    onClick = { onConnect(vm.buildGoogleAuthIntent()) },
                    loading = state.isWorking,
                    enabled = state.googleClientId.isNotBlank()
                )
            }
        }
    }
}
