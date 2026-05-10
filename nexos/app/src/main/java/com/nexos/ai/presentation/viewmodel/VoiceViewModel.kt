package com.nexos.ai.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexos.ai.util.NexosOrchestrator
import com.nexos.ai.voice.VoiceInputManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class VoiceViewModel @Inject constructor(
    private val voice: VoiceInputManager,
    private val orchestrator: NexosOrchestrator
) : ViewModel() {

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            voice.events.collect { event ->
                when (event) {
                    is VoiceInputManager.Event.Ready ->
                        _state.value = _state.value.copy(status = Status.Listening)
                    is VoiceInputManager.Event.BeginningOfSpeech ->
                        _state.value = _state.value.copy(status = Status.Listening)
                    is VoiceInputManager.Event.Partial ->
                        _state.value = _state.value.copy(transcript = event.text)
                    is VoiceInputManager.Event.EndOfSpeech ->
                        _state.value = _state.value.copy(status = Status.Processing)
                    is VoiceInputManager.Event.Final -> {
                        _state.value = _state.value.copy(transcript = event.text, status = Status.Saving)
                        viewModelScope.launch {
                            val result = orchestrator.handleVoiceTranscript(event.text)
                            _state.value = _state.value.copy(
                                status = Status.Done,
                                error = (result as? com.nexos.ai.domain.model.WorkflowState.Failed)?.error
                            )
                        }
                    }
                    is VoiceInputManager.Event.Error ->
                        _state.value = _state.value.copy(status = Status.Done, error = event.message)
                }
            }
        }
    }

    fun start() {
        _state.value = UiState(status = Status.Connecting)
        voice.start()
    }

    fun stop() { voice.stop() }
    fun cancel() { voice.cancel(); _state.value = UiState(status = Status.Idle) }

    enum class Status { Idle, Connecting, Listening, Processing, Saving, Done }

    data class UiState(
        val status: Status = Status.Idle,
        val transcript: String = "",
        val error: String? = null
    )
}
