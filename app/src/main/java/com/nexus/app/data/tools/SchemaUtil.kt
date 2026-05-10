package com.nexus.app.data.tools

import com.nexus.app.data.network.nexusJson
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

internal fun parseSchema(json: String): JsonElement = nexusJson.parseToJsonElement(json)

internal fun parseArguments(json: String): JsonObject =
    runCatching { nexusJson.parseToJsonElement(json).let { it as? JsonObject ?: JsonObject(emptyMap()) } }
        .getOrDefault(JsonObject(emptyMap()))
