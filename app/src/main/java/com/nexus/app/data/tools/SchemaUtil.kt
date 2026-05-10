package com.nexus.app.data.tools

import com.nexus.app.data.network.nexusJson
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.buildJsonObject

internal fun parseSchema(json: String): JsonElement = nexusJson.parseToJsonElement(json)

internal fun parseArguments(json: String): JsonObject =
    runCatching { nexusJson.parseToJsonElement(json).let { it as? JsonObject ?: JsonObject(emptyMap()) } }
        .getOrDefault(JsonObject(emptyMap()))

/**
 * B-12 fix: serialise tool results through `kotlinx.serialization.json` so
 * arbitrary subject lines / event titles / snippets can never break the JSON
 * payload sent back to the LLM.
 */
internal fun toolJson(builder: JsonObjectBuilder.() -> Unit): String =
    nexusJson.encodeToString(JsonObject.serializer(), buildJsonObject(builder))

internal fun toolJsonArray(items: List<JsonObject>): String =
    nexusJson.encodeToString(
        kotlinx.serialization.builtins.ListSerializer(JsonObject.serializer()),
        items
    )
