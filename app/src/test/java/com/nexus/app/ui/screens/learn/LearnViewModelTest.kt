package com.nexus.app.ui.screens.learn

import com.google.common.truth.Truth.assertThat
import com.nexus.app.data.learn.TutorialRegistry
import org.junit.Test

class LearnViewModelTest {

    private val vm = LearnViewModel(TutorialRegistry())

    @Test
    fun `sections are non-empty and only include categories with content`() {
        val sections = vm.uiState.value.sections
        assertThat(sections).isNotEmpty()
        sections.forEach { assertThat(it.tutorials).isNotEmpty() }
    }

    @Test
    fun `openTutorial sets the active tutorial and step zero`() {
        val sample = vm.uiState.value.sections.first().tutorials.first()
        vm.openTutorial(sample)
        val state = vm.uiState.value
        assertThat(state.activeTutorial).isEqualTo(sample)
        assertThat(state.activeStepIndex).isEqualTo(0)
    }

    @Test
    fun `nextStep clamps at the last step`() {
        val sample = vm.uiState.value.sections.first().tutorials.first()
        vm.openTutorial(sample)
        repeat(sample.steps.size + 5) { vm.nextStep() }
        assertThat(vm.uiState.value.activeStepIndex).isEqualTo(sample.steps.lastIndex)
    }

    @Test
    fun `previousStep clamps at zero`() {
        val sample = vm.uiState.value.sections.first().tutorials.first()
        vm.openTutorial(sample)
        repeat(5) { vm.previousStep() }
        assertThat(vm.uiState.value.activeStepIndex).isEqualTo(0)
    }

    @Test
    fun `closeTutorial clears the active selection`() {
        val sample = vm.uiState.value.sections.first().tutorials.first()
        vm.openTutorial(sample)
        vm.closeTutorial()
        val state = vm.uiState.value
        assertThat(state.activeTutorial).isNull()
        assertThat(state.activeStepIndex).isEqualTo(0)
    }
}
