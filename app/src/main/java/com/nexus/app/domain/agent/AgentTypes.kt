package com.nexus.app.domain.agent

enum class AgentStatus {
    IDLE,
    PROCESSING_INTENT,
    EXECUTING_TOOL,
    REQUIRES_ACTION
}

data class UiMessage(
    val id: Long,
    val role: String,
    val text: String
)

data class PendingAction(
    val toolCallId: String,
    val toolName: String,
    val argumentsJson: String,
    val summary: String,
    val detail: String
)

data class ToolResult(
    val toolCallId: String,
    val toolName: String,
    val contentJson: String,
    val isError: Boolean = false
)
