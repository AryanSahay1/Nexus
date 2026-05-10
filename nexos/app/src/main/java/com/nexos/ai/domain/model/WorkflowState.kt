package com.nexos.ai.domain.model

sealed class WorkflowState {
    data object Idle : WorkflowState()
    data object Capturing : WorkflowState()
    data object ExtractingText : WorkflowState()
    data object AiProcessing : WorkflowState()
    data object Saving : WorkflowState()
    data class Done(val note: Note) : WorkflowState()
    data class Failed(val error: String, val step: String) : WorkflowState()
}
