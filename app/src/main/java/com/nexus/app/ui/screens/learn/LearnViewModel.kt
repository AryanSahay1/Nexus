package com.nexus.app.ui.screens.learn

import androidx.lifecycle.ViewModel
import com.nexus.app.data.learn.Tutorial
import com.nexus.app.data.learn.TutorialCategory
import com.nexus.app.data.learn.TutorialRegistry
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class LearnUiState(
    val sections: List<LearnSection>,
    val activeTutorial: Tutorial? = null,
    val activeStepIndex: Int = 0,
    val activeError: String? = null
)

data class LearnSection(
    val category: TutorialCategory,
    val tutorials: List<Tutorial>
)

@HiltViewModel
class LearnViewModel @Inject constructor(
    registry: TutorialRegistry
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        LearnUiState(
            sections = TutorialCategory.entries.map { category ->
                LearnSection(
                    category = category,
                    tutorials = registry.byCategory(category)
                )
            }.filter { it.tutorials.isNotEmpty() }
        )
    )
    val uiState: StateFlow<LearnUiState> = _uiState.asStateFlow()

    fun openTutorial(tutorial: Tutorial) {
        _uiState.update {
            it.copy(activeTutorial = tutorial, activeStepIndex = 0, activeError = null)
        }
    }

    fun closeTutorial() {
        _uiState.update {
            it.copy(activeTutorial = null, activeStepIndex = 0, activeError = null)
        }
    }

    fun nextStep() {
        _uiState.update { state ->
            val tutorial = state.activeTutorial ?: return@update state
            val next = (state.activeStepIndex + 1).coerceAtMost(tutorial.steps.lastIndex)
            state.copy(activeStepIndex = next, activeError = null)
        }
    }

    fun previousStep() {
        _uiState.update { state ->
            val previous = (state.activeStepIndex - 1).coerceAtLeast(0)
            state.copy(activeStepIndex = previous, activeError = null)
        }
    }

    fun reportActionError(message: String?) {
        _uiState.update { it.copy(activeError = message) }
    }
}
