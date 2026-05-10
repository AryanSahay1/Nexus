package com.nexus.app.ui.screens.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.NexusLog
import com.nexus.app.core.NexusResult
import com.nexus.app.data.secure.AuthStateBus
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class OnboardingUiState(
    val apiKey: String = "",
    val isSaving: Boolean = false,
    val errorMessage: String? = null
)

sealed class OnboardingUiEvent {
    data object Saved : OnboardingUiEvent()
}

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val tokenStore: TokenStore,
    private val authStateBus: AuthStateBus
) : ViewModel() {

    private val _uiState = MutableStateFlow(OnboardingUiState())
    val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

    private val _events = Channel<OnboardingUiEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    fun onApiKeyChange(value: String) {
        _uiState.update { it.copy(apiKey = value, errorMessage = null) }
    }

    fun saveKey() {
        val key = _uiState.value.apiKey.trim()
        val validation = validateOpenAiKey(key)
        if (validation != null) {
            _uiState.update { it.copy(errorMessage = validation) }
            return
        }
        _uiState.update { it.copy(isSaving = true, errorMessage = null) }
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                tokenStore.set(Provider.OpenAI, TokenType.ApiKey, key)
            }
            when (result) {
                is NexusResult.Ok -> {
                    NexusLog.i("openai_api_key_saved", mapOf("provider" to "openai"))
                    _uiState.update { it.copy(isSaving = false) }
                    authStateBus.publish()
                    _events.trySend(OnboardingUiEvent.Saved)
                }
                is NexusResult.Err -> _uiState.update {
                    it.copy(isSaving = false, errorMessage = result.error.message)
                }
            }
        }
    }
}

internal fun validateOpenAiKey(key: String): String? {
    if (key.isBlank()) return "Key cannot be empty."
    if (!key.startsWith("sk-")) return "Key must start with \"sk-\"."
    if (key.any { it.isWhitespace() }) return "Key must not contain whitespace."
    if (key.length < 20) return "Key looks too short."
    return null
}
