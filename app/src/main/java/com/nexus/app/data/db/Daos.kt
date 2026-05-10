package com.nexus.app.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PreferencesDao {

    @Query("SELECT * FROM user_preferences ORDER BY updated_at DESC")
    fun observeAll(): Flow<List<PreferenceEntity>>

    @Query("SELECT * FROM user_preferences ORDER BY updated_at DESC")
    suspend fun getAll(): List<PreferenceEntity>

    @Query("SELECT * FROM user_preferences WHERE key = :key LIMIT 1")
    suspend fun findByKey(key: String): PreferenceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(preference: PreferenceEntity): Long

    @Query("DELETE FROM user_preferences WHERE key = :key")
    suspend fun deleteByKey(key: String): Int

    @Query("DELETE FROM user_preferences")
    suspend fun deleteAll()
}

@Dao
interface ChatHistoryDao {

    @Query("SELECT * FROM chat_history ORDER BY id ASC")
    fun observeAll(): Flow<List<ChatMessageEntity>>

    @Query("SELECT * FROM chat_history ORDER BY id ASC")
    suspend fun getAll(): List<ChatMessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: ChatMessageEntity): Long

    @Delete
    suspend fun delete(message: ChatMessageEntity)

    @Query("DELETE FROM chat_history")
    suspend fun deleteAll()
}
