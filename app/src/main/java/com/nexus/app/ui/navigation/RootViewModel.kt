package com.nexus.app.ui.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.data.secure.AuthStateBus
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class RootUiState(
    val isLoading: Boolean = true,
    val startDestination: String? = null
)

@HiltViewModel
class RootViewModel @Inject constructor(
    private val tokenStore: TokenStore,
    private val authStateBus: AuthStateBus
) : ViewModel() {

    private val _uiState = MutableStateFlow(RootUiState())
    val uiState: StateFlow<RootUiState> = _uiState.asStateFlow()

    init {
        resolveStartDestination()
        viewModelScope.launch {
            authStateBus.events.collect { resolveStartDestination() }
        }
    }

    /**
     * Public entry point so other surfaces (e.g. `SettingsScreen` after a
     * factory reset) can ask the root navigator to re-evaluate the start
     * destination instead of leaving the user stranded on the previous tab
     * (B-24).
     */
    fun resolveStartDestination() {
        _uiState.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            val hasOpenAi = withContext(Dispatchers.IO) {
                tokenStore.get(Provider.OpenAI, TokenType.ApiKey).getOrNull() != null
            }
            _uiState.update {
                it.copy(
                    isLoading = false,
                    startDestination = if (hasOpenAi) NexusDestinations.TABS else NexusDestinations.ONBOARDING
                )
            }
        }
    }
}
