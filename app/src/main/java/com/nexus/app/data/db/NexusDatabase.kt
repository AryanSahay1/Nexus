package com.nexus.app.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [PreferenceEntity::class, ChatMessageEntity::class],
    version = 1,
    exportSchema = false
)
abstract class NexusDatabase : RoomDatabase() {
    abstract fun preferencesDao(): PreferencesDao
    abstract fun chatHistoryDao(): ChatHistoryDao
}
