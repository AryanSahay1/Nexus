package com.nexus.app.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "user_preferences",
    indices = [Index(value = ["key"], unique = true)]
)
data class PreferenceEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val key: String,
    val value: String,
    val category: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long
)

@Entity(tableName = "chat_history")
data class ChatMessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val role: String,
    val content: String,
    @ColumnInfo(name = "tool_call_id") val toolCallId: String?,
    @ColumnInfo(name = "tool_name") val toolName: String?,
    @ColumnInfo(name = "tool_calls_json") val toolCallsJson: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long
)
