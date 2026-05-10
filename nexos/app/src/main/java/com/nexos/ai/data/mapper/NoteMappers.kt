package com.nexos.ai.data.mapper

import com.nexos.ai.data.local.entity.NoteEntity
import com.nexos.ai.domain.model.Note
import com.nexos.ai.domain.model.SourceType

fun NoteEntity.toDomain(): Note = Note(
    id = id,
    title = title,
    content = content,
    summary = summary,
    sourceType = SourceType.fromKey(sourceType),
    timestamp = timestamp,
    tags = tags.split(",").map { it.trim() }.filter { it.isNotEmpty() },
    rawImagePath = rawImagePath,
)

fun Note.toEntity(): NoteEntity = NoteEntity(
    id = id,
    title = title,
    content = content,
    summary = summary,
    sourceType = sourceType.key,
    timestamp = timestamp,
    tags = tags.joinToString(","),
    rawImagePath = rawImagePath,
)
