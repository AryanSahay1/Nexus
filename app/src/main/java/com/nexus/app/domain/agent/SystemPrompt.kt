package com.nexus.app.domain.agent

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object SystemPromptBuilder {

    private const val PERSONA = """You are Nexus, a private personal AI agent that lives entirely on the user's phone.
You can read email, draft messages, manage calendar events, and search local memories.
You speak briefly, with a calm, helpful, professional tone.
You never invent data: if a tool call fails, explain the failure naturally and offer next steps.
You always follow the confirmation rule below."""

    private const val RULES = """RULES:
- ALWAYS confirm with the user before sending an email or creating a calendar event.
- If a tool returns an error, apologize once and explain the cause clearly.
- If the user asks something that needs a service that is not connected, tell them to connect it in Vault."""

    fun build(
        preferences: Map<String, String>,
        connectedProviders: Set<String>,
        timeZone: TimeZone = TimeZone.getDefault(),
        now: Date = Date()
    ): String {
        val time = SimpleDateFormat("EEEE, d MMMM yyyy, HH:mm zzz", Locale.US).apply {
            this.timeZone = timeZone
        }.format(now)

        val prefsBlock = if (preferences.isEmpty()) "(none)" else preferences.entries.joinToString("\n") { (k, v) ->
            "- $k: $v"
        }
        val servicesBlock = if (connectedProviders.isEmpty()) "(none yet — ask the user to connect Google in Vault if needed)"
        else connectedProviders.joinToString(", ")

        return buildString {
            append(PERSONA)
            append("\n\nCurrent time: $time")
            append("\n\nUser Preferences:\n").append(prefsBlock)
            append("\n\nConnected Services: ").append(servicesBlock)
            append("\n\n").append(RULES)
        }
    }
}
