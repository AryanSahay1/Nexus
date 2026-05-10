package com.nexos.ai.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexos.ai.data.local.entity.Note
import com.nexos.ai.data.repository.NoteRepository
import com.nexos.ai.domain.model.WorkflowState
import com.nexos.ai.util.WorkflowBus
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class NotesViewModel @Inject constructor(
    private val notes: NoteRepository,
    private val bus: WorkflowBus
) : ViewModel() {

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    val filteredNotes: StateFlow<List<Note>> =
        _query.flatMapLatest { q -> notes.searchNotes(q) }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = emptyList()
            )

    val workflow: StateFlow<WorkflowState> = bus.state

    fun onQueryChange(q: String) { _query.value = q }

    fun delete(id: Long) = viewModelScope.launch { notes.deleteNote(id) }
}
