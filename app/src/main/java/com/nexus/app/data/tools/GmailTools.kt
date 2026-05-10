package com.nexus.app.data.tools

import android.util.Base64
import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.core.runCatchingNexus
import com.nexus.app.data.service.GmailSendRequest
import com.nexus.app.data.service.GoogleApiService
import com.nexus.app.domain.agent.Tool
import com.nexus.app.domain.agent.ToolSummary
import javax.inject.Inject
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonPrimitive

class GmailReadRecentTool @Inject constructor(
    private val google: GoogleApiService
) : Tool {
    override val name = "gmail_read_recent"
    override val description = "Lists the user's recent Gmail messages. Optional Gmail search query."
    override val isDestructive = false
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{
            "limit":{"type":"integer","description":"max 10","minimum":1,"maximum":10},
            "query":{"type":"string","description":"Gmail search syntax, e.g. 'is:unread'"}
          },"required":[]}"""
    )

    override fun summarize(argumentsJson: String) =
        ToolSummary(title = "Read Gmail", detail = "List recent messages")

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val args = parseArguments(argumentsJson)
        val limit = (args["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 5).coerceIn(1, 10)
        val query = args["query"]?.jsonPrimitive?.content
        return runCatchingNexus(NexusErrorCode.NETWORK) {
            val list = google.listGmailMessages(max = limit, q = query)
            if (!list.isSuccessful) throw NexusError(
                code = NexusErrorCode.PROVIDER_ERROR,
                message = "Gmail list returned HTTP ${list.code()}",
                isRetryable = list.code() in 500..599
            )
            val refs = list.body()?.messages.orEmpty()
            val results = refs.take(limit).mapNotNull { ref ->
                val msg = google.getGmailMessage(ref.id).body() ?: return@mapNotNull null
                val headers = msg.payload?.headers.orEmpty().associateBy { it.name }
                """{"id":"${msg.id}","from":"${headers["From"]?.value ?: ""}","subject":"${headers["Subject"]?.value ?: ""}","snippet":"${(msg.snippet ?: "").replace("\"", "'")}"}"""
            }
            "[${results.joinToString(",")}]"
        }
    }
}

class GmailSendTool @Inject constructor(
    private val google: GoogleApiService
) : Tool {
    override val name = "gmail_send_email"
    override val description = "Sends an email via Gmail. Always confirm with user first."
    override val isDestructive = true
    override val parametersSchema: JsonElement = parseSchema(
        """{"type":"object","properties":{
            "to":{"type":"string"},
            "subject":{"type":"string"},
            "body":{"type":"string"}
          },"required":["to","subject","body"]}"""
    )

    override fun summarize(argumentsJson: String): ToolSummary {
        val a = parseArguments(argumentsJson)
        val to = a["to"]?.jsonPrimitive?.content ?: "?"
        val subject = a["subject"]?.jsonPrimitive?.content ?: "?"
        val body = a["body"]?.jsonPrimitive?.content ?: ""
        return ToolSummary(
            title = "Send email to $to",
            detail = "Subject: $subject\n\n$body"
        )
    }

    override suspend fun execute(argumentsJson: String): NexusResult<String> {
        val args = parseArguments(argumentsJson)
        val to = args["to"]?.jsonPrimitive?.content
        val subject = args["subject"]?.jsonPrimitive?.content
        val body = args["body"]?.jsonPrimitive?.content
        if (to.isNullOrBlank() || subject.isNullOrBlank() || body == null) {
            return NexusResult.err(
                NexusError(NexusErrorCode.INVALID_PARAMETER, "to, subject, and body are required")
            )
        }
        val raw = "To: $to\r\nSubject: $subject\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\n\r\n$body"
        val encoded = Base64.encodeToString(
            raw.toByteArray(Charsets.UTF_8),
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
        )
        return runCatchingNexus(NexusErrorCode.NETWORK) {
            val resp = google.sendGmailMessage(GmailSendRequest(raw = encoded))
            if (!resp.isSuccessful) throw NexusError(
                code = NexusErrorCode.PROVIDER_ERROR,
                message = "Gmail send returned HTTP ${resp.code()}",
                isRetryable = resp.code() in 500..599
            )
            val id = resp.body()?.id ?: ""
            """{"ok":true,"id":"$id"}"""
        }
    }
}
