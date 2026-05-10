package com.nexos.ai.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexos.ai.ai.AnthropicProvider
import com.nexos.ai.ai.GeminiProvider
import com.nexos.ai.ai.GroqProvider
import com.nexos.ai.ai.OpenAIProvider
import com.nexos.ai.data.repository.SettingsRepository
import com.nexos.ai.data.secure.SecureStorage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProviderInfo(
    val key: String,
    val displayName: String,
    val hasKey: Boolean,
)

data class SettingsUiState(
    val activeProvider: String = "none",
    val autoSummarize: Boolean = true,
    val autoSave: Boolean = true,
    val floatingButtonSide: String = "right",
    val showFloatingButton: Boolean = false,
    val providers: List<ProviderInfo> = emptyList(),
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepo: SettingsRepository,
    private val secureStorage: SecureStorage,
    private val openAi: OpenAIProvider,
    private val gemini: GeminiProvider,
    private val anthropic: AnthropicProvider,
    private val groq: GroqProvider,
) : ViewModel() {

    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    val state: StateFlow<SettingsUiState> = combineSettings()

    private fun combineSettings(): StateFlow<SettingsUiState> {
        val flow = kotlinx.coroutines.flow.combine(
            settingsRepo.aiProvider,
            settingsRepo.autoSummarize,
            settingsRepo.autoSave,
            settingsRepo.floatingButtonSide,
            settingsRepo.showFloatingButton,
        ) { provider, summarize, save, side, show ->
            SettingsUiState(
                activeProvider = provider,
                autoSummarize = summarize,
                autoSave = save,
                floatingButtonSide = side,
                showFloatingButton = show,
                providers = listOf(
                    ProviderInfo("none", "None (rule-based)", true),
                    ProviderInfo("openai", "OpenAI", openAi.hasKey()),
                    ProviderInfo("gemini", "Gemini", gemini.hasKey()),
                    ProviderInfo("anthropic", "Anthropic", anthropic.hasKey()),
                    ProviderInfo("groq", "Groq", groq.hasKey()),
                ),
            )
        }
        return flow.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = SettingsUiState(),
        )
    }

    fun selectProvider(key: String) {
        viewModelScope.launch { settingsRepo.setAiProvider(key) }
    }

    fun saveApiKey(provider: String, key: String) {
        if (provider == "none") return
        if (key.isBlank()) {
            secureStorage.clearApiKey(provider)
            _statusMessage.value = "Cleared $provider key"
        } else {
            secureStorage.saveApiKey(provider, key.trim())
            _statusMessage.value = "Saved $provider key"
        }
    }

    fun setAutoSummarize(value: Boolean) {
        viewModelScope.launch { settingsRepo.setAutoSummarize(value) }
    }

    fun setAutoSave(value: Boolean) {
        viewModelScope.launch { settingsRepo.setAutoSave(value) }
    }

    fun setFloatingButtonSide(value: String) {
        viewModelScope.launch { settingsRepo.setFloatingButtonSide(value) }
    }

    fun setShowFloatingButton(value: Boolean) {
        viewModelScope.launch { settingsRepo.setShowFloatingButton(value) }
    }

    fun clearStatus() { _statusMessage.value = null }
}
