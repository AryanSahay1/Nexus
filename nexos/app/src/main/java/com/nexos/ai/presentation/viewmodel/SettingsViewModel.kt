package com.nexos.ai.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexos.ai.ai.AIRouter
import com.nexos.ai.data.repository.SettingsRepository
import com.nexos.ai.domain.model.AiProviderKey
import com.nexos.ai.domain.model.FloatingButtonSide
import com.nexos.ai.domain.model.NexosSettings
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repo: SettingsRepository,
    private val router: AIRouter
) : ViewModel() {

    val settings: StateFlow<NexosSettings> = repo.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), NexosSettings())

    /** Stored, masked API keys keyed by provider key. */
    val maskedKeys: StateFlow<Map<AiProviderKey, String>> = MutableStateFlow(loadMasked()).asStateFlow()

    private val _testResult = MutableStateFlow<TestResult?>(null)
    val testResult: StateFlow<TestResult?> = _testResult.asStateFlow()

    fun setProvider(p: AiProviderKey)              = viewModelScope.launch { repo.setProvider(p) }
    fun setAutoSummarize(enabled: Boolean)         = viewModelScope.launch { repo.setAutoSummarize(enabled) }
    fun setAutoSave(enabled: Boolean)              = viewModelScope.launch { repo.setAutoSave(enabled) }
    fun setShowFloatingButton(enabled: Boolean)    = viewModelScope.launch { repo.setShowFloatingButton(enabled) }
    fun setFloatingSide(side: FloatingButtonSide)  = viewModelScope.launch { repo.setFloatingSide(side) }

    fun saveApiKey(provider: AiProviderKey, key: String) {
        if (key.isBlank()) repo.clearApiKey(provider) else repo.saveApiKey(provider, key)
        (maskedKeys as MutableStateFlow).value = loadMasked()
    }

    fun testConnection(provider: AiProviderKey) = viewModelScope.launch {
        _testResult.value = TestResult.Pending(provider)
        val ok = runCatching { router.providerFor(provider).testConnection() }.getOrDefault(false)
        _testResult.value = if (ok) TestResult.Success(provider) else TestResult.Failure(provider)
    }

    fun clearTestResult() { _testResult.value = null }

    private fun loadMasked(): Map<AiProviderKey, String> =
        AiProviderKey.values()
            .filter { it != AiProviderKey.NONE }
            .associateWith { p ->
                val k = repo.apiKeyFor(p)
                if (k.isNullOrBlank()) "" else maskKey(k)
            }

    private fun maskKey(k: String): String {
        if (k.length <= 8) return "•".repeat(k.length)
        return k.take(4) + "•".repeat(k.length - 8).take(8) + k.takeLast(4)
    }

    sealed class TestResult {
        abstract val provider: AiProviderKey
        data class Pending(override val provider: AiProviderKey) : TestResult()
        data class Success(override val provider: AiProviderKey) : TestResult()
        data class Failure(override val provider: AiProviderKey) : TestResult()
    }
}
