package com.nexus.app.data.service

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface GoogleApiService {

    @GET("gmail/v1/users/me/messages")
    suspend fun listGmailMessages(
        @Query("maxResults") max: Int = 10,
        @Query("q") q: String? = null
    ): Response<GmailListResponse>

    @GET("gmail/v1/users/me/messages/{id}")
    suspend fun getGmailMessage(
        @Path("id") id: String,
        @Query("format") format: String = "metadata",
        @Query("metadataHeaders") metadataHeaders: List<String> = listOf("Subject", "From", "Date")
    ): Response<GmailMessage>

    @POST("gmail/v1/users/me/messages/send")
    suspend fun sendGmailMessage(
        @Body body: GmailSendRequest
    ): Response<GmailMessage>

    @GET("calendar/v3/calendars/primary/events")
    suspend fun listCalendarEvents(
        @Query("timeMin") timeMin: String,
        @Query("timeMax") timeMax: String? = null,
        @Query("maxResults") max: Int = 10,
        @Query("singleEvents") singleEvents: Boolean = true,
        @Query("orderBy") orderBy: String = "startTime"
    ): Response<CalendarListResponse>

    @POST("calendar/v3/calendars/primary/events")
    suspend fun createCalendarEvent(
        @Body event: CalendarEvent
    ): Response<CalendarEvent>
}

@Serializable
data class GmailListResponse(val messages: List<GmailMessageRef> = emptyList())

@Serializable
data class GmailMessageRef(val id: String, val threadId: String? = null)

@Serializable
data class GmailMessage(
    val id: String,
    val threadId: String? = null,
    val snippet: String? = null,
    val payload: GmailPayload? = null
)

@Serializable
data class GmailPayload(
    val headers: List<GmailHeader> = emptyList()
)

@Serializable
data class GmailHeader(val name: String, val value: String)

@Serializable
data class GmailSendRequest(val raw: String)

@Serializable
data class CalendarListResponse(val items: List<CalendarEvent> = emptyList())

@Serializable
data class CalendarEvent(
    val id: String? = null,
    val summary: String? = null,
    val description: String? = null,
    val start: CalendarEventTime? = null,
    val end: CalendarEventTime? = null,
    val attendees: List<CalendarAttendee>? = null,
    @SerialName("htmlLink") val htmlLink: String? = null
)

@Serializable
data class CalendarEventTime(
    val dateTime: String? = null,
    val date: String? = null,
    val timeZone: String? = null
)

@Serializable
data class CalendarAttendee(val email: String)
