package com.nexus.app.ui.screens.vault

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.NexusLog
import com.nexus.app.core.NexusResult
import com.nexus.app.data.oauth.GoogleOAuthClient
import com.nexus.app.data.secure.AuthStateBus
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import com.nexus.app.domain.auth.ASSISTIVE_ONLY_MARKER
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class VaultUiState(
    val openAiConnected: Boolean = false,
    val openAiKeyMasked: String? = null,
    val isAssistiveOnly: Boolean = false,
    val googleConnected: Boolean = false,
    val googleEmail: String? = null,
    val googleClientId: String = "",
    val errorMessage: String? = null,
    val isWorking: Boolean = false
)

@HiltViewModel
class VaultViewModel @Inject constructor(
    private val tokenStore: TokenStore,
    private val oauth: GoogleOAuthClient,
    private val authStateBus: AuthStateBus
) : ViewModel() {

    private val _uiState = MutableStateFlow(VaultUiState())
    val uiState: StateFlow<VaultUiState> = _uiState.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            val (openAiKey, googleAccess, googleEmail, savedClientId) = withContext(Dispatchers.IO) {
                Snapshot(
                    openAiKey = tokenStore.get(Provider.OpenAI, TokenType.ApiKey).getOrNull(),
                    googleAccess = tokenStore.get(Provider.Google, TokenType.AccessToken).getOrNull(),
                    googleEmail = tokenStore.get(Provider.Google, TokenType.UserEmail).getOrNull(),
                    googleClientId = tokenStore.get(Provider.Google, TokenType.ClientId).getOrNull()
                )
            }
            val isAssistiveOnly = openAiKey == ASSISTIVE_ONLY_MARKER
            _uiState.update {
                it.copy(
                    openAiConnected = !openAiKey.isNullOrBlank() && !isAssistiveOnly,
                    openAiKeyMasked = if (isAssistiveOnly) null else openAiKey?.let(::maskKey),
                    isAssistiveOnly = isAssistiveOnly,
                    googleConnected = !googleAccess.isNullOrBlank(),
                    googleEmail = googleEmail,
                    googleClientId = savedClientId.orEmpty()
                )
            }
        }
    }

    /**
     * B-18 fix: keep the draft in UI state only; do NOT persist on every
     * keystroke. The encrypted prefs round-trip on each character was
     * visibly lagging the input on slower devices.
     */
    fun setGoogleClientId(value: String) {
        _uiState.update { it.copy(googleClientId = value, errorMessage = null) }
    }

    fun buildGoogleAuthIntent(): Intent? {
        val clientId = _uiState.value.googleClientId.trim()
        if (clientId.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Paste your Google OAuth Client ID first.") }
            return null
        }
        // Persist once, at the moment we actually start the OAuth dance.
        viewModelScope.launch(Dispatchers.IO) {
            tokenStore.set(Provider.Google, TokenType.ClientId, clientId)
        }
        return oauth.buildAuthIntent(clientId)
    }

    fun handleAuthResult(data: Intent?) {
        val intent = data ?: return
        _uiState.update { it.copy(isWorking = true) }
        viewModelScope.launch {
            val result = oauth.handleAuthResponse(intent)
            when (result) {
                is NexusResult.Ok -> {
                    NexusLog.i("oauth_connected", mapOf("provider" to "google"))
                    authStateBus.publish()
                }
                is NexusResult.Err -> _uiState.update { it.copy(errorMessage = result.error.message) }
            }
            _uiState.update { it.copy(isWorking = false) }
            refresh()
        }
    }

    fun disconnectGoogle() {
        _uiState.update { it.copy(isWorking = true) }
        viewModelScope.launch {
            withContext(Dispatchers.IO) { oauth.disconnect() }
            authStateBus.publish()
            _uiState.update { it.copy(isWorking = false) }
            refresh()
        }
    }

    fun replaceOpenAiKey(value: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                tokenStore.set(Provider.OpenAI, TokenType.ApiKey, value)
            }
            authStateBus.publish()
            refresh()
        }
    }

    fun disconnectOpenAi() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { tokenStore.delete(Provider.OpenAI, TokenType.ApiKey) }
            authStateBus.publish()
            refresh()
        }
    }

    private data class Snapshot(
        val openAiKey: String?,
        val googleAccess: String?,
        val googleEmail: String?,
        val googleClientId: String?
    )
}

internal fun maskKey(key: String): String {
    if (key.length <= 6) return "•••${key.takeLast(2)}"
    return key.take(3) + "•".repeat(6) + key.takeLast(4)
}
