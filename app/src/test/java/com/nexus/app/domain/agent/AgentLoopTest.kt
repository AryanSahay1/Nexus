package com.nexus.app.domain.agent

import com.google.common.truth.Truth.assertThat
import com.nexus.app.core.NexusResult
import com.nexus.app.data.repo.PreferencesRepository
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.service.ChatCompletionChoice
import com.nexus.app.data.service.ChatCompletionRequest
import com.nexus.app.data.service.ChatCompletionResponse
import com.nexus.app.data.service.ChatMessageDto
import com.nexus.app.data.service.ChatToolCallDto
import com.nexus.app.data.service.ChatToolCallFunctionDto
import com.nexus.app.data.service.OpenAiService
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import org.junit.Test

class AgentLoopTest {

    private val openAi: OpenAiService = mockk()
    private val preferencesRepo: PreferencesRepository = mockk(relaxed = true)
    private val tokenStore: TokenStore = mockk(relaxed = true)

    private val readTool = StubTool(
        name = "fake_read",
        destructive = false,
        result = NexusResult.ok("""{"items":[]}""")
    )
    private val sendTool = StubTool(
        name = "fake_send",
        destructive = true,
        result = NexusResult.ok("""{"ok":true}""")
    )

    private val registry = ToolRegistry(setOf(readTool, sendTool))

    private val loop = AgentLoop(
        openAi = openAi,
        toolRegistry = registry,
        preferencesRepo = preferencesRepo,
        tokenStore = tokenStore
    )

    init {
        coEvery { preferencesRepo.snapshot() } returns emptyMap()
        every { tokenStore.connectedProviders() } returns NexusResult.ok(setOf<Provider>())
    }

    @Test
    fun `loop returns a plain assistant message when no tool is called`() = runTest {
        coEvery { openAi.chatCompletion(any()) } returns NexusResult.ok(
            ChatCompletionResponse(
                id = "1",
                choices = listOf(
                    ChatCompletionChoice(
                        index = 0,
                        message = ChatMessageDto(role = "assistant", content = "hello there"),
                        finishReason = "stop"
                    )
                )
            )
        )
        val events = Channel<AgentLoop.AgentEvent>(Channel.UNLIMITED)
        val result = loop.run(
            history = emptyList(),
            userMessage = "hi",
            events = events,
            confirmationGate = { AgentLoop.Confirmation.Confirm }
        )
        events.close()

        assertThat(result.isOk).isTrue()
        val collected = drain(events)
        assertThat(collected.filterIsInstance<AgentLoop.AgentEvent.AssistantMessage>())
            .containsExactly(AgentLoop.AgentEvent.AssistantMessage("hello there"))
    }

    @Test
    fun `non-destructive tool runs without confirmation gate`() = runTest {
        coEvery { openAi.chatCompletion(any()) } returnsMany listOf(
            // First turn: tool call
            NexusResult.ok(
                ChatCompletionResponse(
                    id = "1",
                    choices = listOf(
                        ChatCompletionChoice(
                            index = 0,
                            message = ChatMessageDto(
                                role = "assistant",
                                content = null,
                                toolCalls = listOf(
                                    ChatToolCallDto(
                                        id = "call_1",
                                        function = ChatToolCallFunctionDto(
                                            name = "fake_read",
                                            arguments = "{}"
                                        )
                                    )
                                )
                            ),
                            finishReason = "tool_calls"
                        )
                    )
                )
            ),
            // Second turn: assistant wraps up
            NexusResult.ok(
                ChatCompletionResponse(
                    id = "2",
                    choices = listOf(
                        ChatCompletionChoice(
                            index = 0,
                            message = ChatMessageDto(role = "assistant", content = "done"),
                            finishReason = "stop"
                        )
                    )
                )
            )
        )

        val events = Channel<AgentLoop.AgentEvent>(Channel.UNLIMITED)
        var gateCalled = false
        val result = loop.run(
            history = emptyList(),
            userMessage = "list",
            events = events,
            confirmationGate = {
                gateCalled = true
                AgentLoop.Confirmation.Confirm
            }
        )
        events.close()

        assertThat(result.isOk).isTrue()
        assertThat(gateCalled).isFalse()
        assertThat(readTool.callCount).isEqualTo(1)
    }

    @Test
    fun `destructive tool waits for confirmation - cancel skips execution`() = runTest {
        coEvery { openAi.chatCompletion(any()) } returnsMany listOf(
            NexusResult.ok(
                ChatCompletionResponse(
                    id = "1",
                    choices = listOf(
                        ChatCompletionChoice(
                            index = 0,
                            message = ChatMessageDto(
                                role = "assistant",
                                content = null,
                                toolCalls = listOf(
                                    ChatToolCallDto(
                                        id = "call_2",
                                        function = ChatToolCallFunctionDto(
                                            name = "fake_send",
                                            arguments = """{"to":"x@example.com","body":"hi"}"""
                                        )
                                    )
                                )
                            ),
                            finishReason = "tool_calls"
                        )
                    )
                )
            ),
            NexusResult.ok(
                ChatCompletionResponse(
                    id = "2",
                    choices = listOf(
                        ChatCompletionChoice(
                            index = 0,
                            message = ChatMessageDto(role = "assistant", content = "ok cancelled"),
                            finishReason = "stop"
                        )
                    )
                )
            )
        )
        val events = Channel<AgentLoop.AgentEvent>(Channel.UNLIMITED)
        val result = loop.run(
            history = emptyList(),
            userMessage = "send it",
            events = events,
            confirmationGate = { AgentLoop.Confirmation.Cancel }
        )
        events.close()

        assertThat(result.isOk).isTrue()
        assertThat(sendTool.callCount).isEqualTo(0)
    }

    @Test
    fun `iteration cap returns AGENT_ITERATION_CAP`() = runTest {
        // Always return tool_calls — never finishes naturally.
        coEvery { openAi.chatCompletion(any()) } returns NexusResult.ok(
            ChatCompletionResponse(
                id = "1",
                choices = listOf(
                    ChatCompletionChoice(
                        index = 0,
                        message = ChatMessageDto(
                            role = "assistant",
                            content = null,
                            toolCalls = listOf(
                                ChatToolCallDto(
                                    id = "call_loop",
                                    function = ChatToolCallFunctionDto(
                                        name = "fake_read", arguments = "{}"
                                    )
                                )
                            )
                        ),
                        finishReason = "tool_calls"
                    )
                )
            )
        )
        val events = Channel<AgentLoop.AgentEvent>(Channel.UNLIMITED)
        val result = loop.run(
            history = emptyList(),
            userMessage = "loop",
            events = events,
            confirmationGate = { AgentLoop.Confirmation.Confirm }
        )
        events.close()
        assertThat(result.isErr).isTrue()
    }

    private fun drain(channel: Channel<AgentLoop.AgentEvent>): List<AgentLoop.AgentEvent> {
        val out = mutableListOf<AgentLoop.AgentEvent>()
        while (true) {
            val r = channel.tryReceive()
            if (r.isClosed || r.isFailure) break
            r.getOrNull()?.let { out += it }
        }
        return out
    }

    private class StubTool(
        override val name: String,
        destructive: Boolean,
        private val result: NexusResult<String>
    ) : Tool {
        override val description = "stub"
        override val isDestructive = destructive
        override val parametersSchema = JsonObject(emptyMap())
        var callCount = 0
            private set

        override fun summarize(argumentsJson: String): ToolSummary =
            ToolSummary("stub", "stub call")

        override suspend fun execute(argumentsJson: String): NexusResult<String> {
            callCount += 1
            return result
        }
    }
}
