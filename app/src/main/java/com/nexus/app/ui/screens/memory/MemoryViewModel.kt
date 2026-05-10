package com.nexus.app.ui.screens.memory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.data.repo.PreferencesRepository
import com.nexus.app.data.repo.UserPreference
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MemoryUiState(
    val keyDraft: String = "",
    val valueDraft: String = "",
    val errorMessage: String? = null
)

@HiltViewModel
class MemoryViewModel @Inject constructor(
    private val repo: PreferencesRepository
) : ViewModel() {

    val preferences: StateFlow<List<UserPreference>> = repo.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _uiState = MutableStateFlow(MemoryUiState())
    val uiState: StateFlow<MemoryUiState> = _uiState.asStateFlow()

    fun onKeyChange(value: String) {
        _uiState.update { it.copy(keyDraft = value, errorMessage = null) }
    }

    fun onValueChange(value: String) {
        _uiState.update { it.copy(valueDraft = value, errorMessage = null) }
    }

    fun save() {
        val key = _uiState.value.keyDraft.trim()
        val value = _uiState.value.valueDraft.trim()
        if (key.isBlank() || value.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Both key and value are required.") }
            return
        }
        viewModelScope.launch {
            repo.upsert(key = key, value = value)
            _uiState.update { it.copy(keyDraft = "", valueDraft = "") }
        }
    }

    fun delete(key: String) {
        viewModelScope.launch { repo.delete(key) }
    }
}
