package com.nexos.ai.domain.usecase

import com.nexos.ai.data.local.entity.Note
import com.nexos.ai.data.repository.NoteRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetAllNotesUseCase @Inject constructor(private val repo: NoteRepository) {
    operator fun invoke(): Flow<List<Note>> = repo.allNotes
}

class SearchNotesUseCase @Inject constructor(private val repo: NoteRepository) {
    operator fun invoke(query: String): Flow<List<Note>> = repo.searchNotes(query)
}

class DeleteNoteUseCase @Inject constructor(private val repo: NoteRepository) {
    suspend operator fun invoke(id: Long) = repo.deleteNote(id)
}

class GetNoteByIdUseCase @Inject constructor(private val repo: NoteRepository) {
    suspend operator fun invoke(id: Long): Note? = repo.getNoteById(id)
}

class UpdateNoteUseCase @Inject constructor(private val repo: NoteRepository) {
    suspend operator fun invoke(note: Note) = repo.updateNote(note)
}
