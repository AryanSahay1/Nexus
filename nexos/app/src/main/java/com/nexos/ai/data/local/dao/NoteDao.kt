package com.nexos.ai.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.nexos.ai.data.local.entity.Note
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(note: Note): Long

    @Update
    suspend fun update(note: Note)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM notes")
    suspend fun deleteAll()

    @Query("SELECT * FROM notes ORDER BY timestamp DESC")
    fun getAllNotes(): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE id = :id LIMIT 1")
    suspend fun getNoteById(id: Long): Note?

    @Query("""
        SELECT * FROM notes
        WHERE title   LIKE '%' || :query || '%'
           OR content LIKE '%' || :query || '%'
           OR summary LIKE '%' || :query || '%'
           OR tags    LIKE '%' || :query || '%'
        ORDER BY timestamp DESC
    """)
    fun searchNotes(query: String): Flow<List<Note>>

    @Query("SELECT * FROM notes ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentNotes(limit: Int): Flow<List<Note>>

    @Query("SELECT COUNT(*) FROM notes")
    suspend fun getNoteCount(): Int
}
