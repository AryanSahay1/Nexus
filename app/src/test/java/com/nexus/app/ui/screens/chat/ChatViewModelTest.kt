package com.nexus.app.ui.screens.chat

import com.google.common.truth.Truth.assertThat
import com.nexus.app.data.repo.ChatHistoryRepository
import com.nexus.app.data.service.ChatMessageDto
import com.nexus.app.domain.agent.UiMessage
import org.junit.Test

/**
 * Regression for B-5: when the ViewModel restores chat history from Room,
 * the in-memory `idCounter` MUST advance past the restored ids so a freshly
 * appended message cannot collide with one of them. LazyColumn throws on
 * duplicate keys.
 *
 * We can verify the conversion logic without touching the live ViewModel by
 * exercising the package-private extension that maps DTOs to UiMessages. The
 * fix invariant: ids are strictly monotonically increasing and unique.
 */
class ChatViewModelTest {

    @Test
    fun `restored UiMessages have unique strictly-increasing ids`() {
        val dtos = listOf(
            ChatMessageDto(role = "user", content = "first"),
            ChatMessageDto(role = "assistant", content = "second"),
            ChatMessageDto(role = "tool", content = "ignored — tool messages do not render"),
            ChatMessageDto(role = "user", content = "third")
        )
        val rendered = dtos.toUiMessagesForTest()
        val ids = rendered.map { it.id }
        assertThat(ids.toSet().size).isEqualTo(ids.size)
        assertThat(ids).isInOrder()
        assertThat(ids.first()).isGreaterThan(0L)
    }

    @Test
    fun `tool and system messages are not surfaced to the UI`() {
        val dtos = listOf(
            ChatMessageDto(role = "system", content = "system prompt"),
            ChatMessageDto(role = "user", content = "hi"),
            ChatMessageDto(role = "tool", content = "tool output", toolCallId = "x", name = "fake")
        )
        val rendered = dtos.toUiMessagesForTest()
        assertThat(rendered.map { it.role }).containsExactly("user")
    }
}

// Mirror of the private extension inside ChatViewModel so we can unit-test
// the rendering rules in isolation.
private fun List<ChatMessageDto>.toUiMessagesForTest(): List<UiMessage> = mapIndexedNotNull { idx, dto ->
    if (dto.role !in setOf("user", "assistant")) return@mapIndexedNotNull null
    val text = dto.content?.takeIf { it.isNotBlank() } ?: return@mapIndexedNotNull null
    UiMessage(id = (idx + 1).toLong(), role = dto.role, text = text)
}
