package com.nexus.app.domain.agent

import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusLog
import com.nexus.app.core.NexusResult
import com.nexus.app.data.service.ChatCompletionRequest
import com.nexus.app.data.service.ChatMessageDto
import com.nexus.app.data.service.OpenAiService
import com.nexus.app.data.secure.Provider
import com.nexus.app.data.secure.TokenStore
import com.nexus.app.data.secure.TokenType
import com.nexus.app.data.repo.PreferencesRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.Channel

/**
 * Recursive tool-calling agent (LAW 6).
 *
 * Hard caps:
 *  - max 10 iterations per `run` (returns a graceful timeout message).
 *
 * State machine emissions go through [stateSink] so the UI ViewModel can
 * react and so destructive tool calls can be paused at the confirmation gate.
 */
@Singleton
class AgentLoop @Inject constructor(
    private val openAi: OpenAiService,
    private val toolRegistry: ToolRegistry,
    private val preferencesRepo: PreferencesRepository,
    private val tokenStore: TokenStore
) {
    companion object {
        const val MAX_ITERATIONS = 10
        const val DEFAULT_MODEL = "gpt-4o-mini"
    }

    /**
     * The ViewModel awaits a confirmation by reading from this channel after
     * the agent emits a [AgentEvent.RequiresAction] event.
     */
    sealed class Confirmation {
        data object Confirm : Confirmation()
        data object Cancel : Confirmation()
    }

    sealed class AgentEvent {
        data class StatusChange(val status: AgentStatus, val toolName: String? = null) : AgentEvent()
        data class AssistantMessage(val text: String) : AgentEvent()
        data class ToolStarted(val toolName: String) : AgentEvent()
        data class ToolFinished(val toolName: String, val isError: Boolean) : AgentEvent()
        data class RequiresAction(val pending: PendingAction) : AgentEvent()
        data class Failed(val error: NexusError) : AgentEvent()
    }

    suspend fun run(
        history: List<ChatMessageDto>,
        userMessage: String,
        events: Channel<AgentEvent>,
        confirmationGate: suspend (PendingAction) -> Confirmation
    ): NexusResult<List<ChatMessageDto>> {
        events.send(AgentEvent.StatusChange(AgentStatus.PROCESSING_INTENT))

        val systemPrompt = SystemPromptBuilder.build(
            preferences = preferencesRepo.snapshot(),
            connectedProviders = tokenStore.connectedProviders().getOrNull()?.map { it.id }?.toSet() ?: emptySet()
        )

        val messages = mutableListOf<ChatMessageDto>().apply {
            add(ChatMessageDto(role = "system", content = systemPrompt))
            addAll(history)
            add(ChatMessageDto(role = "user", content = userMessage))
        }

        val tools = toolRegistry.openAiToolDefinitions()
        var iteration = 0

        while (iteration < MAX_ITERATIONS) {
            iteration += 1
            NexusLog.i("agent_iteration", mapOf("iteration" to iteration))

            val request = ChatCompletionRequest(
                model = DEFAULT_MODEL,
                messages = messages.toList(),
                tools = if (tools.isEmpty()) null else tools,
                toolChoice = if (tools.isEmpty()) null else "auto"
            )
            val resp = openAi.chatCompletion(request)
            val response = when (resp) {
                is NexusResult.Err -> {
                    events.send(AgentEvent.Failed(resp.error))
                    events.send(AgentEvent.StatusChange(AgentStatus.IDLE))
                    return resp
                }
                is NexusResult.Ok -> resp.value
            }

            val choice = response.choices.firstOrNull()
            if (choice == null) {
                events.send(AgentEvent.Failed(
                    NexusError(NexusErrorCode.PROVIDER_ERROR, "OpenAI returned no choices.")
                ))
                events.send(AgentEvent.StatusChange(AgentStatus.IDLE))
                return NexusResult.err(NexusError(NexusErrorCode.PROVIDER_ERROR, "Empty choices"))
            }

            val assistantMsg = choice.message
            messages.add(assistantMsg)

            val toolCalls = assistantMsg.toolCalls.orEmpty()
            if (toolCalls.isEmpty()) {
                val text = assistantMsg.content?.takeIf { it.isNotBlank() } ?: "(no response)"
                events.send(AgentEvent.AssistantMessage(text))
                events.send(AgentEvent.StatusChange(AgentStatus.IDLE))
                return NexusResult.ok(messages)
            }

            for (call in toolCalls) {
                val tool = toolRegistry.byName(call.function.name)
                if (tool == null) {
                    val errJson = """{"error":"unknown_tool","tool":"${call.function.name}"}"""
                    messages.add(
                        ChatMessageDto(
                            role = "tool",
                            content = errJson,
                            toolCallId = call.id,
                            name = call.function.name
                        )
                    )
                    events.send(AgentEvent.ToolFinished(call.function.name, isError = true))
                    continue
                }

                if (tool.isDestructive) {
                    val summary = tool.summarize(call.function.arguments)
                    val pending = PendingAction(
                        toolCallId = call.id,
                        toolName = tool.name,
                        argumentsJson = call.function.arguments,
                        summary = summary.title,
                        detail = summary.detail
                    )
                    events.send(AgentEvent.StatusChange(AgentStatus.REQUIRES_ACTION, tool.name))
                    events.send(AgentEvent.RequiresAction(pending))
                    val verdict = confirmationGate(pending)
                    if (verdict is Confirmation.Cancel) {
                        messages.add(
                            ChatMessageDto(
                                role = "tool",
                                content = """{"cancelled":true,"message":"User cancelled this action."}""",
                                toolCallId = call.id,
                                name = tool.name
                            )
                        )
                        events.send(AgentEvent.ToolFinished(tool.name, isError = false))
                        continue
                    }
                }

                events.send(AgentEvent.StatusChange(AgentStatus.EXECUTING_TOOL, tool.name))
                events.send(AgentEvent.ToolStarted(tool.name))

                val execResult = tool.execute(call.function.arguments)
                val (content, isError) = when (execResult) {
                    is NexusResult.Ok -> execResult.value to false
                    is NexusResult.Err -> {
                        val err = execResult.error
                        """{"error":"${err.code.name}","message":"${err.message.replace("\"", "'")}"}""" to true
                    }
                }
                messages.add(
                    ChatMessageDto(
                        role = "tool",
                        content = content,
                        toolCallId = call.id,
                        name = tool.name
                    )
                )
                events.send(AgentEvent.ToolFinished(tool.name, isError = isError))
            }
        }

        events.send(AgentEvent.AssistantMessage(
            "I tried several steps but couldn't finish. Could you rephrase what you'd like me to do?"
        ))
        events.send(AgentEvent.StatusChange(AgentStatus.IDLE))
        return NexusResult.err(NexusError(NexusErrorCode.AGENT_ITERATION_CAP, "Max iterations reached"))
    }
}
