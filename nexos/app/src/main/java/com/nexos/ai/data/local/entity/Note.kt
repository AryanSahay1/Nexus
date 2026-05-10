package com.nexos.ai.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "notes")
data class Note(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val content: String,
    val summary: String = "",
    /** "screenshot" | "voice" | "manual" */
    val sourceType: String,
    val timestamp: Long = System.currentTimeMillis(),
    /** Comma-separated. Empty string means none. */
    val tags: String = "",
    val isSynced: Boolean = false,
    val rawImagePath: String = ""
)
