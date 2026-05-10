package com.nexos.ai.data.repository

import com.nexos.ai.data.local.dao.NoteDao
import com.nexos.ai.data.mapper.toDomain
import com.nexos.ai.data.mapper.toEntity
import com.nexos.ai.domain.model.Note
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteRepository @Inject constructor(
    private val noteDao: NoteDao,
) {
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO

    val allNotes: Flow<List<Note>> =
        noteDao.getAllNotes().map { list -> list.map { it.toDomain() } }

    fun searchNotes(query: String): Flow<List<Note>> =
        noteDao.searchNotes(query).map { list -> list.map { it.toDomain() } }

    fun recentNotes(limit: Int = 10): Flow<List<Note>> =
        noteDao.getRecentNotes(limit).map { list -> list.map { it.toDomain() } }

    suspend fun insertNote(note: Note): Long = withContext(ioDispatcher) {
        noteDao.insert(note.toEntity())
    }

    suspend fun updateNote(note: Note) = withContext(ioDispatcher) {
        noteDao.update(note.toEntity())
    }

    suspend fun deleteNote(id: Long) = withContext(ioDispatcher) {
        noteDao.deleteById(id)
    }

    suspend fun getNoteById(id: Long): Note? = withContext(ioDispatcher) {
        noteDao.getNoteById(id)?.toDomain()
    }

    suspend fun count(): Int = withContext(ioDispatcher) { noteDao.getNoteCount() }
}
