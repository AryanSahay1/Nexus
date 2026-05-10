package com.nexus.app.domain.agent

import com.nexus.app.data.service.ChatFunctionDto
import com.nexus.app.data.service.ChatToolDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ToolRegistry @Inject constructor(
    private val tools: Set<@JvmSuppressWildcards Tool>
) {
    fun all(): List<Tool> = tools.toList()

    fun byName(name: String): Tool? = tools.firstOrNull { it.name == name }

    fun openAiToolDefinitions(): List<ChatToolDto> = tools.map { tool ->
        ChatToolDto(
            type = "function",
            function = ChatFunctionDto(
                name = tool.name,
                description = tool.description,
                parameters = tool.parametersSchema
            )
        )
    }
}
