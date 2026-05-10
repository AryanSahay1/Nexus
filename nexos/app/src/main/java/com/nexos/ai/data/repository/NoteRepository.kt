package com.nexos.ai.data.repository

import com.nexos.ai.data.local.dao.NoteDao
import com.nexos.ai.data.local.entity.Note
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteRepository @Inject constructor(
    private val noteDao: NoteDao,
    private val io: CoroutineDispatcher = Dispatchers.IO
) {
    val allNotes: Flow<List<Note>> = noteDao.getAllNotes()

    fun searchNotes(query: String): Flow<List<Note>> =
        if (query.isBlank()) noteDao.getAllNotes()
        else noteDao.searchNotes(query.trim())

    suspend fun insertNote(note: Note): Long = withContext(io) { noteDao.insert(note) }
    suspend fun updateNote(note: Note)       = withContext(io) { noteDao.update(note) }
    suspend fun deleteNote(id: Long)         = withContext(io) { noteDao.deleteById(id) }
    suspend fun getNoteById(id: Long): Note? = withContext(io) { noteDao.getNoteById(id) }
    suspend fun count(): Int                 = withContext(io) { noteDao.getNoteCount() }
}
