package com.nexus.app.data.tools

import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.core.runCatchingNexus
import com.nexus.app.data.service.CalendarAttendee
import com.nexus.app.data.service.CalendarEvent
import com.nexus.app.data.service.CalendarEventTime
import com.nexus.app.data.service.GoogleApiService
import com.nexus.app.domain.agent.Tool
import com.nexus.app.domain.agent.ToolSummary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonPrimitive

private val ISO_NOW: () -> String = {
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }
        .format(Date())
}

class CalendarNextEventTool @Inject constructor(
    private val google: GoogleApiService
) : Tool {
    override val name = "calendar_next_event"
    override val description = "Returns the user's next upcoming calendar event."
    override val isDestructive = false
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{},"required":[]}"""
    )

    override fun summarize(argumentsJson: String) =
        ToolSummary(title = "Calendar", detail = "Get next event")

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        return runCatchingNexus(NexusErrorCode.NETWORK) {
            val resp = google.listCalendarEvents(timeMin = ISO_NOW(), max = 1)
            if (!resp.isSuccessful) throw NexusError(
                code = NexusErrorCode.PROVIDER_ERROR,
                message = "Calendar list returned HTTP ${resp.code()}",
                isRetryable = resp.code() in 500..599
            )
            val event = resp.body()?.items?.firstOrNull()
                ?: return@runCatchingNexus toolJson {
                    put("event", null as String?)
                    put("message", "No upcoming events")
                }
            toolJson {
                put("summary", event.summary ?: "")
                put("start", event.start?.dateTime ?: event.start?.date ?: "")
                put("end", event.end?.dateTime ?: event.end?.date ?: "")
                put("htmlLink", event.htmlLink ?: "")
            }
        }
    }
}

class CalendarCreateEventTool @Inject constructor(
    private val google: GoogleApiService
) : Tool {
    override val name = "calendar_create_event"
    override val description = "Creates a new event on the user's primary Google Calendar."
    override val isDestructive = true
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{
            "summary":{"type":"string"},
            "start_time":{"type":"string","description":"ISO 8601 e.g. 2026-06-15T14:00:00+05:30"},
            "end_time":{"type":"string","description":"ISO 8601"},
            "attendees":{"type":"array","items":{"type":"string"}},
            "description":{"type":"string"}
          },"required":["summary","start_time","end_time"]}"""
    )

    override fun summarize(argumentsJson: String): ToolSummary {
        val a = parseArguments(argumentsJson)
        val title = a["summary"]?.jsonPrimitive?.content ?: "?"
        val start = a["start_time"]?.jsonPrimitive?.content ?: ""
        val end = a["end_time"]?.jsonPrimitive?.content ?: ""
        val attendees = (a["attendees"] as? JsonArray)?.joinToString { it.jsonPrimitive.content }.orEmpty()
        return ToolSummary(
            title = "Create event: $title",
            detail = buildString {
                append("$start → $end")
                if (attendees.isNotBlank()) append("\nAttendees: $attendees")
            }
        )
    }

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val a = parseArguments(argumentsJson)
        val title = a["summary"]?.jsonPrimitive?.content
        val start = a["start_time"]?.jsonPrimitive?.content
        val end = a["end_time"]?.jsonPrimitive?.content
        val description = a["description"]?.jsonPrimitive?.content
        val attendees = (a["attendees"] as? JsonArray)?.map { it.jsonPrimitive.content }.orEmpty()
        if (title.isNullOrBlank() || start.isNullOrBlank() || end.isNullOrBlank()) {
            return NexusResult.err(
                NexusError(NexusErrorCode.INVALID_PARAMETER, "summary, start_time, end_time required")
            )
        }
        val event = CalendarEvent(
            summary = title,
            description = description,
            start = CalendarEventTime(dateTime = start),
            end = CalendarEventTime(dateTime = end),
            attendees = attendees.map { CalendarAttendee(email = it) }.takeIf { it.isNotEmpty() }
        )
        return runCatchingNexus(NexusErrorCode.NETWORK) {
            val resp = google.createCalendarEvent(event)
            if (!resp.isSuccessful) throw NexusError(
                code = NexusErrorCode.PROVIDER_ERROR,
                message = "Calendar create returned HTTP ${resp.code()}",
                isRetryable = resp.code() in 500..599
            )
            val created = resp.body()
            toolJson {
                put("ok", true)
                put("id", created?.id ?: "")
                put("htmlLink", created?.htmlLink ?: "")
            }
        }
    }
}
