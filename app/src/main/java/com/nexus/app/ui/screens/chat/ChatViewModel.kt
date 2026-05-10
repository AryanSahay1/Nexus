package com.nexus.app.ui.screens.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.NexusLog
import com.nexus.app.core.NexusResult
import com.nexus.app.data.repo.ChatHistoryRepository
import com.nexus.app.data.service.ChatMessageDto
import com.nexus.app.domain.agent.AgentLoop
import com.nexus.app.domain.agent.AgentStatus
import com.nexus.app.domain.agent.PendingAction
import com.nexus.app.domain.agent.UiMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ChatUiState(
    val messages: List<UiMessage> = emptyList(),
    val input: String = "",
    val status: AgentStatus = AgentStatus.IDLE,
    val activeToolName: String? = null,
    val pendingAction: PendingAction? = null,
    val errorMessage: String? = null
) {
    val canSend: Boolean get() = status == AgentStatus.IDLE
}

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val agentLoop: AgentLoop,
    private val historyRepo: ChatHistoryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private var idCounter = 0L
    private var pendingDeferred: CompletableDeferred<AgentLoop.Confirmation>? = null
    private var loopJob: Job? = null

    init {
        viewModelScope.launch {
            val snapshot = withContext(Dispatchers.IO) { historyRepo.snapshot() }
            _uiState.update { state ->
                state.copy(messages = snapshot.toUiMessages())
            }
        }
    }

    fun onInputChange(value: String) {
        _uiState.update { it.copy(input = value, errorMessage = null) }
    }

    fun confirmAction() {
        pendingDeferred?.complete(AgentLoop.Confirmation.Confirm)
        pendingDeferred = null
        _uiState.update { it.copy(pendingAction = null) }
    }

    fun cancelAction() {
        pendingDeferred?.complete(AgentLoop.Confirmation.Cancel)
        pendingDeferred = null
        _uiState.update { it.copy(pendingAction = null) }
    }

    fun sendMessage() {
        val text = _uiState.value.input.trim()
        if (text.isBlank() || _uiState.value.status != AgentStatus.IDLE) return

        val userMessage = ChatMessageDto(role = "user", content = text)
        appendUiMessage(role = "user", text = text)
        _uiState.update { it.copy(input = "", status = AgentStatus.PROCESSING_INTENT) }

        loopJob = viewModelScope.launch {
            withContext(Dispatchers.IO) { historyRepo.append(userMessage) }
            val history = withContext(Dispatchers.IO) { historyRepo.snapshot() }
                .filter { it.role != "user" || it != userMessage }

            val events = Channel<AgentLoop.AgentEvent>(Channel.BUFFERED)
            val eventConsumer = launch { consumeEvents(events) }

            val result = agentLoop.run(
                history = history,
                userMessage = text,
                events = events,
                confirmationGate = { pending ->
                    val deferred = CompletableDeferred<AgentLoop.Confirmation>()
                    pendingDeferred = deferred
                    deferred.await()
                }
            )

            events.close()
            eventConsumer.join()

            when (result) {
                is NexusResult.Ok -> {
                    val newMessages = result.value.drop(history.size + 2)
                    val combined = listOf(userMessage) + newMessages
                    withContext(Dispatchers.IO) {
                        historyRepo.appendAll(combined.drop(1))
                    }
                }
                is NexusResult.Err -> {
                    NexusLog.w("agent_loop_error", mapOf("error_code" to result.error.code.name))
                    _uiState.update { it.copy(errorMessage = result.error.message) }
                }
            }
            _uiState.update { it.copy(status = AgentStatus.IDLE, activeToolName = null) }
        }
    }

    fun clearConversation() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { historyRepo.clear() }
            _uiState.update { it.copy(messages = emptyList()) }
        }
    }

    private suspend fun consumeEvents(events: Channel<AgentLoop.AgentEvent>) {
        for (event in events) {
            when (event) {
                is AgentLoop.AgentEvent.StatusChange -> _uiState.update {
                    it.copy(status = event.status, activeToolName = event.toolName)
                }
                is AgentLoop.AgentEvent.AssistantMessage -> appendUiMessage("assistant", event.text)
                is AgentLoop.AgentEvent.RequiresAction -> _uiState.update {
                    it.copy(pendingAction = event.pending)
                }
                is AgentLoop.AgentEvent.ToolStarted,
                is AgentLoop.AgentEvent.ToolFinished -> Unit
                is AgentLoop.AgentEvent.Failed -> _uiState.update {
                    it.copy(errorMessage = event.error.message)
                }
            }
        }
    }

    private fun appendUiMessage(role: String, text: String) {
        idCounter += 1
        val item = UiMessage(id = idCounter, role = role, text = text)
        _uiState.update { it.copy(messages = it.messages + item) }
    }

    private fun List<ChatMessageDto>.toUiMessages(): List<UiMessage> = mapIndexedNotNull { idx, dto ->
        if (dto.role !in setOf("user", "assistant")) return@mapIndexedNotNull null
        val text = dto.content?.takeIf { it.isNotBlank() } ?: return@mapIndexedNotNull null
        UiMessage(id = (idx + 1).toLong(), role = dto.role, text = text)
    }
}
