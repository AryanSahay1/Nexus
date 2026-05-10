package com.nexus.app.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.data.repo.ChatHistoryRepository
import com.nexus.app.data.repo.PreferencesRepository
import com.nexus.app.data.secure.AuthStateBus
import com.nexus.app.data.secure.TokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class SettingsUiState(
    val isResetting: Boolean = false,
    val resetCompleted: Boolean = false,
    val showResetConfirm: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val tokenStore: TokenStore,
    private val historyRepo: ChatHistoryRepository,
    private val preferencesRepo: PreferencesRepository,
    private val authStateBus: AuthStateBus
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    fun requestReset() {
        _uiState.update { it.copy(showResetConfirm = true) }
    }

    fun cancelReset() {
        _uiState.update { it.copy(showResetConfirm = false) }
    }

    fun confirmReset() {
        _uiState.update { it.copy(showResetConfirm = false, isResetting = true) }
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                tokenStore.wipe()
                historyRepo.clear()
                preferencesRepo.deleteAll()
            }
            _uiState.update { it.copy(isResetting = false, resetCompleted = true) }
            // B-24 fix: tell the root navigator to re-evaluate the start
            // destination. Without this, the user would be stuck on the
            // Settings tab with no API key, and any send-to-chat would crash.
            authStateBus.publish()
        }
    }
}
