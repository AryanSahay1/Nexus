package com.nexus.app.ui.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
    val startDestination: String = NexusDestinations.ONBOARDING
)

@HiltViewModel
class RootViewModel @Inject constructor(
    private val tokenStore: TokenStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(RootUiState())
    val uiState: StateFlow<RootUiState> = _uiState.asStateFlow()

    init { resolveStartDestination() }

    private fun resolveStartDestination() {
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
