package com.nexus.app.ui.screens.onboarding

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class OnboardingValidationTest {

    @Test fun `empty key is rejected`() {
        assertThat(validateOpenAiKey("")).isNotNull()
    }

    @Test fun `key without sk- prefix is rejected`() {
        assertThat(validateOpenAiKey("foobar1234567890abcd")).contains("sk-")
    }

    @Test fun `key with whitespace is rejected`() {
        assertThat(validateOpenAiKey("sk-abc def 12345678901234")).isNotNull()
    }

    @Test fun `short key is rejected`() {
        assertThat(validateOpenAiKey("sk-short")).isNotNull()
    }

    @Test fun `valid key passes`() {
        assertThat(validateOpenAiKey("sk-abcdefghijklmnopqr1234")).isNull()
    }
}
