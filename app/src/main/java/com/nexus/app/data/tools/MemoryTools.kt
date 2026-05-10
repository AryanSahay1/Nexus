package com.nexus.app.data.tools

import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.data.network.nexusJson
import com.nexus.app.data.repo.PreferencesRepository
import com.nexus.app.domain.agent.Tool
import com.nexus.app.domain.agent.ToolSummary
import javax.inject.Inject
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonPrimitive

class RememberTool @Inject constructor(
    private val repo: PreferencesRepository
) : Tool {
    override val name = "memory_remember"
    override val description = "Stores a small key/value preference about the user. Use for facts the user explicitly tells you to remember."
    override val isDestructive = false
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{
            "key":{"type":"string","description":"snake_case identifier, e.g. 'wife_name' or 'email_tone'"},
            "value":{"type":"string","description":"value to remember"},
            "category":{"type":"string","description":"optional category, defaults to 'general'"}
          },"required":["key","value"]}"""
    )

    override fun summarize(argumentsJson: String): ToolSummary {
        val args = parseArguments(argumentsJson)
        val k = args["key"]?.jsonPrimitive?.content ?: "?"
        val v = args["value"]?.jsonPrimitive?.content ?: ""
        return ToolSummary(title = "Remember $k", detail = v)
    }

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val args = parseArguments(argumentsJson)
        val key = args["key"]?.jsonPrimitive?.content
        val value = args["value"]?.jsonPrimitive?.content
        val category = args["category"]?.jsonPrimitive?.content ?: "general"
        if (key.isNullOrBlank() || value == null) {
            return NexusResult.err(
                NexusError(NexusErrorCode.INVALID_PARAMETER, "key and value are required")
            )
        }
        return repo.upsert(key, value, category).map {
            toolJson {
                put("ok", true)
                put("key", key)
            }
        }
    }
}

class RecallTool @Inject constructor(
    private val repo: PreferencesRepository
) : Tool {
    override val name = "memory_recall"
    override val description = "Lists everything Nexus currently remembers. Returns key/value pairs."
    override val isDestructive = false
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{},"required":[]}"""
    )

    override fun summarize(argumentsJson: String): ToolSummary =
        ToolSummary(title = "Recall memory", detail = "List stored preferences")

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val snapshot = repo.snapshot()
        val obj = JsonObject(snapshot.mapValues { kotlinx.serialization.json.JsonPrimitive(it.value) })
        return NexusResult.ok(nexusJson.encodeToString(JsonObject.serializer(), obj))
    }
}

class ForgetTool @Inject constructor(
    private val repo: PreferencesRepository
) : Tool {
    override val name = "memory_forget"
    override val description = "Removes one stored preference by key."
    override val isDestructive = true
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{"key":{"type":"string"}},"required":["key"]}"""
    )

    override fun summarize(argumentsJson: String): ToolSummary {
        val k = parseArguments(argumentsJson)["key"]?.jsonPrimitive?.content ?: "?"
        return ToolSummary(title = "Forget memory", detail = "Delete preference '$k'")
    }

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val key = parseArguments(argumentsJson)["key"]?.jsonPrimitive?.content
            ?: return NexusResult.err(
                NexusError(NexusErrorCode.INVALID_PARAMETER, "key is required")
            )
        return repo.delete(key).map {
            toolJson {
                put("ok", true)
                put("key", key)
            }
        }
    }
}
