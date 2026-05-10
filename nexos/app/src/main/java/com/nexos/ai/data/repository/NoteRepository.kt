package com.nexos.ai.data.repository

import com.nexos.ai.data.local.dao.NoteDao
import com.nexos.ai.data.local.entity.Note
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteRepository @Inject constructor(
    private val noteDao: NoteDao
) {
    val allNotes: Flow<List<Note>> = noteDao.getAllNotes()

    fun searchNotes(query: String): Flow<List<Note>> =
        if (query.isBlank()) noteDao.getAllNotes()
        else noteDao.searchNotes(query.trim())

    suspend fun insertNote(note: Note): Long = withContext(Dispatchers.IO) { noteDao.insert(note) }
    suspend fun updateNote(note: Note)       = withContext(Dispatchers.IO) { noteDao.update(note) }
    suspend fun deleteNote(id: Long)         = withContext(Dispatchers.IO) { noteDao.deleteById(id) }
    suspend fun getNoteById(id: Long): Note? = withContext(Dispatchers.IO) { noteDao.getNoteById(id) }
    suspend fun count(): Int                 = withContext(Dispatchers.IO) { noteDao.getNoteCount() }
}
