package com.nexus.app.data.repo

import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.core.runCatchingNexus
import com.nexus.app.data.db.ChatHistoryDao
import com.nexus.app.data.db.ChatMessageEntity
import com.nexus.app.data.network.nexusJson
import com.nexus.app.data.service.ChatMessageDto
import com.nexus.app.data.service.ChatToolCallDto
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString

@Singleton
class ChatHistoryRepository @Inject constructor(
    private val dao: ChatHistoryDao
) {
    fun observe(): Flow<List<ChatMessageDto>> = dao.observeAll().map { rows ->
        rows.map { it.toDto() }
    }

    suspend fun snapshot(): List<ChatMessageDto> = dao.getAll().map { it.toDto() }

    suspend fun append(message: ChatMessageDto): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.DATABASE_ERROR) {
            dao.insert(message.toEntity())
        }

    suspend fun appendAll(messages: List<ChatMessageDto>): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.DATABASE_ERROR) {
            messages.forEach { dao.insert(it.toEntity()) }
        }

    suspend fun clear(): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.DATABASE_ERROR) { dao.deleteAll() }
}

private fun ChatMessageDto.toEntity(): ChatMessageEntity = ChatMessageEntity(
    role = role,
    content = content ?: "",
    toolCallId = toolCallId,
    toolName = name,
    toolCallsJson = toolCalls?.let { nexusJson.encodeToString(it) },
    createdAt = System.currentTimeMillis()
)

private fun ChatMessageEntity.toDto(): ChatMessageDto = ChatMessageDto(
    role = role,
    content = content,
    name = toolName,
    toolCallId = toolCallId,
    toolCalls = toolCallsJson?.let {
        nexusJson.decodeFromString<List<ChatToolCallDto>>(it)
    }
)
