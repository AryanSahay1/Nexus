package com.nexus.app.ui.screens.vault

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class VaultMaskTest {

    @Test fun `short keys still mask the prefix`() {
        assertThat(maskKey("abcd")).contains("•••")
        assertThat(maskKey("abcd")).endsWith("cd")
    }

    @Test fun `typical OpenAI key is masked but shows prefix and suffix`() {
        val masked = maskKey("sk-abcdefghijklmnopqr12345678")
        assertThat(masked).startsWith("sk-")
        assertThat(masked).endsWith("5678")
        assertThat(masked).doesNotContain("ghijklmnop")
    }
}
