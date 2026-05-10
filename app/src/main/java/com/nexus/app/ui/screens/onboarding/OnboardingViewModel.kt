package com.nexus.app.ui.screens.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.NexusLog
import com.nexus.app.core.NexusResult
import com.nexus.app.data.secure.AuthStateBus
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import com.nexus.app.domain.auth.ASSISTIVE_ONLY_MARKER
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

enum class OnboardingStep {
    /** Place 2 of 4 — assistive purpose disclosure shown to every new user. */
    Disclosure,

    /** Optional API-key entry. Users can skip it and stay in Assistive Mode. */
    ApiKey
}

data class OnboardingUiState(
    val step: OnboardingStep = OnboardingStep.Disclosure,
    val apiKey: String = "",
    val isSaving: Boolean = false,
    val errorMessage: String? = null
)

sealed class OnboardingUiEvent {
    /** User finished onboarding (with or without an API key). */
    data object Finished : OnboardingUiEvent()
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

    fun acknowledgeDisclosure() {
        _uiState.update { it.copy(step = OnboardingStep.ApiKey, errorMessage = null) }
    }

    /**
     * Lets the user finish onboarding without giving Nexus any API key. They
     * land in Assistive Mode (Learn tab) and can return to enter a key later
     * via Vault.
     */
    fun skipApiKey() {
        viewModelScope.launch {
            // Mark a placeholder so RootViewModel routes us to TABS instead of
            // looping back to onboarding. Stored under a dedicated key, NOT
            // the OpenAI ApiKey slot, so Nexus knows the user opted into the
            // Assistive-Mode-only flow.
            withContext(Dispatchers.IO) {
                tokenStore.set(Provider.OpenAI, TokenType.ApiKey, ASSISTIVE_ONLY_MARKER)
            }
            authStateBus.publish()
            _events.trySend(OnboardingUiEvent.Finished)
        }
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
                    _events.trySend(OnboardingUiEvent.Finished)
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
