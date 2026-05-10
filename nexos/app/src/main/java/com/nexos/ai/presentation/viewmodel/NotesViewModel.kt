package com.nexos.ai.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexos.ai.data.repository.NoteRepository
import com.nexos.ai.domain.model.Note
import com.nexos.ai.domain.model.SourceType
import com.nexos.ai.domain.model.WorkflowState
import com.nexos.ai.util.NexosOrchestrator
import com.nexos.ai.voice.VoiceInputManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class NotesViewModel @Inject constructor(
    private val noteRepository: NoteRepository,
    val orchestrator: NexosOrchestrator,
    private val voice: VoiceInputManager,
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val workflowState: StateFlow<WorkflowState> = orchestrator.state

    val filteredNotes: StateFlow<List<Note>> = _searchQuery
        .flatMapLatest { q ->
            if (q.isBlank()) noteRepository.allNotes else noteRepository.searchNotes(q)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = emptyList(),
        )

    fun onSearchQueryChange(query: String) { _searchQuery.value = query }

    fun deleteNote(id: Long) {
        viewModelScope.launch { noteRepository.deleteNote(id) }
    }

    fun saveManualNote(title: String, content: String) {
        if (title.isBlank() && content.isBlank()) return
        viewModelScope.launch {
            noteRepository.insertNote(
                Note(
                    title = title.ifBlank { content.take(64).ifBlank { "Untitled" } },
                    content = content,
                    sourceType = SourceType.Manual,
                )
            )
        }
    }

    fun resetWorkflow() = orchestrator.reset()

    /** Voice recognition lifecycle. Permission must be granted before calling. */
    fun startVoice() {
        viewModelScope.launch { voice.start() }
        viewModelScope.launch {
            voice.state.collectLatest { state ->
                if (state is VoiceInputManager.State.Result) {
                    orchestrator.handleVoiceTranscript(state.text)
                    voice.release()
                }
            }
        }
    }

    fun stopVoice() {
        viewModelScope.launch { voice.stop() }
    }

    fun releaseVoice() {
        viewModelScope.launch { voice.release() }
    }
}
