package com.nexos.ai.util

import com.nexos.ai.domain.model.WorkflowState
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-wide bus that lets the floating service / receiver push state changes
 * into the UI (and vice versa).
 */
@Singleton
class WorkflowBus @Inject constructor() {

    private val _state = MutableStateFlow<WorkflowState>(WorkflowState.Idle)
    val state: StateFlow<WorkflowState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<Event>(extraBufferCapacity = 8)
    val events: SharedFlow<Event> = _events.asSharedFlow()

    fun update(state: WorkflowState) { _state.value = state }
    suspend fun emit(event: Event) { _events.emit(event) }
    fun tryEmit(event: Event): Boolean = _events.tryEmit(event)

    sealed class Event {
        /** Service is asking the foreground UI to start a voice capture. */
        data object RequestVoiceCapture : Event()
        /** Service is asking the foreground UI to request MediaProjection consent. */
        data object RequestProjectionConsent : Event()
        /** Pipeline just emitted a toast-worthy message. */
        data class Toast(val message: String) : Event()
    }
}
