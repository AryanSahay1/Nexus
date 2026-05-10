package com.nexos.ai.util

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import androidx.core.app.NotificationCompat
import com.nexos.ai.MainActivity
import com.nexos.ai.R
import com.nexos.ai.ai.AIPrompts
import com.nexos.ai.ai.AIRouter
import com.nexos.ai.ai.NoteAIHelper
import com.nexos.ai.data.repository.NoteRepository
import com.nexos.ai.data.repository.SettingsRepository
import com.nexos.ai.domain.model.Note
import com.nexos.ai.domain.model.SourceType
import com.nexos.ai.domain.model.WorkflowState
import com.nexos.ai.ocr.OcrEngine
import com.nexos.ai.service.FloatingButtonService
import com.nexos.ai.service.NotificationChannels
import com.nexos.ai.voice.VoiceInputManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The single coordination point between input (screenshot/voice), processing (OCR/AI),
 * and storage (Room). Stateless on disk; emits a [WorkflowState] flow consumed by the UI.
 */
@Singleton
class NexosOrchestrator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val ocrEngine: OcrEngine,
    private val voice: VoiceInputManager,
    private val aiRouter: AIRouter,
    private val noteRepo: NoteRepository,
    private val settingsRepo: SettingsRepository,
) {
    private val _state = MutableStateFlow<WorkflowState>(WorkflowState.Idle)
    val state: StateFlow<WorkflowState> = _state.asStateFlow()

    val voiceState = voice.state

    suspend fun handleScreenshotBitmap(bitmap: Bitmap) {
        try {
            _state.value = WorkflowState.ExtractingText
            val ocr = ocrEngine.extractText(bitmap)
            if (!ocr.isSuccess || ocr.cleanText.isBlank()) {
                _state.value = WorkflowState.Failed(
                    error = ocr.error ?: "No text found",
                    step = "ocr",
                )
                return
            }
            saveStructuredNote(
                rawText = ocr.cleanText,
                source = SourceType.Screenshot,
                useAI = true,
            )
        } finally {
            try { bitmap.recycle() } catch (_: Throwable) {}
        }
    }

    suspend fun handleVoiceTranscript(transcript: String) {
        if (transcript.isBlank()) {
            _state.value = WorkflowState.Failed("Empty transcript", "voice")
            return
        }
        saveStructuredNote(
            rawText = transcript,
            source = SourceType.Voice,
            useAI = true,
        )
    }

    private suspend fun saveStructuredNote(rawText: String, source: SourceType, useAI: Boolean) {
        _state.value = WorkflowState.AiProcessing
        val providerKey = settingsRepo.aiProvider.first()
        val autoSummarize = settingsRepo.autoSummarize.first()

        val parsed = if (useAI && autoSummarize && aiRouter.isEnabled(providerKey)) {
            val prompt = when (source) {
                SourceType.Screenshot -> AIPrompts.screenshotSummary(rawText)
                SourceType.Voice -> AIPrompts.voiceSummary(rawText)
                SourceType.Manual -> AIPrompts.screenshotSummary(rawText)
            }
            val response = aiRouter.pick(providerKey).complete(prompt)
            if (response.isSuccess) NoteAIHelper.parseJson(response.text)
            else NoteAIHelper.fallback(rawText)
        } else {
            NoteAIHelper.fallback(rawText)
        }

        _state.value = WorkflowState.Saving
        val note = Note(
            title = parsed.title,
            content = rawText,
            summary = parsed.summary.ifBlank { parsed.bullets.joinToString(" • ") },
            sourceType = source,
            tags = listOfNotNull(source.key),
        )
        val id = noteRepo.insertNote(note)
        val saved = note.copy(id = id)
        _state.value = WorkflowState.Done(saved)
        notifyDone(saved)
    }

    fun reset() { _state.value = WorkflowState.Idle }

    fun requestProjectionConsent(context: Context) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = MainActivity.ACTION_REQUEST_PROJECTION
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    suspend fun startVoiceCapture() {
        // Voice happens through the in-app sheet to keep mic + UI on the main thread.
        // Background trigger surfaces the activity; the sheet auto-opens when it sees the action.
        val intent = Intent(context, MainActivity::class.java).apply {
            action = MainActivity.ACTION_START_VOICE
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun toggleFloatingButton(context: Context) {
        val svc = Intent(context, FloatingButtonService::class.java)
        try {
            context.stopService(svc)
        } catch (_: Throwable) {}
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(svc)
        else context.startService(svc)
    }

    private fun notifyDone(note: Note) {
        NotificationChannels.ensure(context)
        val pi = android.app.PendingIntent.getActivity(
            context, note.id.toInt(),
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(context, NotificationChannels.CAPTURE)
            .setSmallIcon(R.drawable.ic_nexos_notification)
            .setContentTitle(context.getString(R.string.notification_capture_done_title))
            .setContentText(context.getString(R.string.notification_capture_done_text, note.title))
            .setStyle(NotificationCompat.BigTextStyle().bigText(note.summary.ifBlank { note.content }))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        nm.notify(note.id.toInt() + 5000, notification)
    }
}
