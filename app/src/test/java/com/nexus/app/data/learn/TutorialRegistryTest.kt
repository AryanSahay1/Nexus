package com.nexus.app.data.learn

import com.google.common.truth.Truth.assertThat
import com.nexus.app.data.intents.DeepLinks
import org.junit.Test

/**
 * Compile-time-style guarantees about the Learn-tab content. If any
 * tutorial step references a deep-link action that DeepLinks doesn't know
 * about, the user would tap the button and see nothing happen — these
 * tests catch the typo at build time instead.
 */
class TutorialRegistryTest {

    private val registry = TutorialRegistry()

    @Test
    fun `every tutorial has at least one step`() {
        registry.all().forEach { tutorial ->
            assertThat(tutorial.steps).isNotEmpty()
        }
    }

    @Test
    fun `tutorial ids are unique`() {
        val ids = registry.all().map { it.id }
        assertThat(ids).containsNoDuplicates()
    }

    @Test
    fun `every action intent is one DeepLinks knows how to resolve`() {
        registry.all().flatMap { it.steps }
            .mapNotNull { it.actionIntent }
            .forEach { intent ->
                assertThat(intent).isIn(DeepLinks.SUPPORTED)
            }
    }

    @Test
    fun `each TutorialCategory is represented by at least one tutorial`() {
        TutorialCategory.entries.forEach { category ->
            assertThat(registry.byCategory(category)).isNotEmpty()
        }
    }

    @Test
    fun `byId returns the requested tutorial or null`() {
        assertThat(registry.byId("calendar_first_event")).isNotNull()
        assertThat(registry.byId("does_not_exist")).isNull()
    }

    @Test
    fun `step bodies are non-blank and reasonably short`() {
        registry.all().flatMap { it.steps }.forEach { step ->
            assertThat(step.body.trim()).isNotEmpty()
            // Tutorial steps are intentionally one-action-each. If we ever
            // exceed ~400 chars in a single step, it's time to split it.
            assertThat(step.body.length).isLessThan(401)
        }
    }
}
