package com.nexos.ai.presentation.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexos.ai.data.repository.NoteRepository
import com.nexos.ai.domain.model.Note
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NoteDetailViewModel @Inject constructor(
    private val noteRepository: NoteRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val noteId: Long = savedStateHandle.get<Long>("id") ?: 0L

    private val _note = MutableStateFlow<Note?>(null)
    val note: StateFlow<Note?> = _note.asStateFlow()

    init {
        viewModelScope.launch {
            _note.value = noteRepository.getNoteById(noteId)
        }
    }

    fun update(title: String, content: String) {
        val current = _note.value ?: return
        viewModelScope.launch {
            val updated = current.copy(title = title, content = content)
            noteRepository.updateNote(updated)
            _note.value = updated
        }
    }

    fun delete(onDone: () -> Unit) {
        val current = _note.value ?: return
        viewModelScope.launch {
            noteRepository.deleteNote(current.id)
            onDone()
        }
    }
}
