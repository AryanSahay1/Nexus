package com.nexus.app.domain.agent

import com.nexus.app.core.NexusResult
import kotlinx.serialization.json.JsonElement

/**
 * Tool contract — every tool exposed to the LLM lives behind this interface.
 *
 * - `name` / `description` / `parametersSchema` build the function definition
 *   sent to OpenAI.
 * - `isDestructive=true` triggers the human-in-the-loop confirmation gate
 *   (LAW 4) before `execute` is called.
 * - `execute` MUST return a `NexusResult` and never throw — failure modes are
 *   surfaced to the LLM as semantic tool-error messages (LAW 3).
 */
interface Tool {
    val name: String
    val description: String
    val parametersSchema: JsonElement
    val isDestructive: Boolean

    fun summarize(argumentsJson: String): ToolSummary

    suspend fun execute(argumentsJson: String): NexusResult<String>
}

data class ToolSummary(
    val title: String,
    val detail: String
)
