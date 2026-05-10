package com.nexos.ai.presentation.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexos.ai.data.local.entity.Note
import com.nexos.ai.data.repository.NoteRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NoteDetailViewModel @Inject constructor(
    private val notes: NoteRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val noteId: Long = savedStateHandle.get<String>("noteId")?.toLongOrNull() ?: -1L

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { load() }

    private fun load() = viewModelScope.launch {
        if (noteId <= 0) {
            _state.value = UiState(isLoading = false, error = "Invalid note id")
            return@launch
        }
        val note = notes.getNoteById(noteId)
        _state.value = UiState(isLoading = false, note = note, error = if (note == null) "Note not found" else null)
    }

    fun save(title: String, content: String) = viewModelScope.launch {
        val current = _state.value.note ?: return@launch
        val updated = current.copy(title = title.trim().ifBlank { current.title }, content = content)
        notes.updateNote(updated)
        _state.value = _state.value.copy(note = updated, isEditing = false)
    }

    fun delete(onDeleted: () -> Unit) = viewModelScope.launch {
        notes.deleteNote(noteId)
        onDeleted()
    }

    fun toggleEdit() { _state.value = _state.value.copy(isEditing = !_state.value.isEditing) }

    data class UiState(
        val isLoading: Boolean = true,
        val isEditing: Boolean = false,
        val note: Note? = null,
        val error: String? = null
    )
}
