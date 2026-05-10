package com.nexos.ai.util

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.nexos.ai.ai.AIPrompts
import com.nexos.ai.ai.AIRouter
import com.nexos.ai.ai.NoteAIHelper
import com.nexos.ai.data.local.entity.Note
import com.nexos.ai.data.repository.NoteRepository
import com.nexos.ai.data.repository.SettingsRepository
import com.nexos.ai.domain.model.OcrResult
import com.nexos.ai.domain.model.ParsedNote
import com.nexos.ai.domain.model.WorkflowState
import com.nexos.ai.ocr.OcrEngine
import com.nexos.ai.service.ScreenshotService
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Coordinates the screenshot → OCR → AI → save pipeline and the voice
 * transcript → AI → save pipeline. The single entry-point for any caller
 * (services, receivers, view-models) that wants to run a capture flow.
 */
@Singleton
class NexosOrchestrator @Inject constructor(
    private val ocrEngine: OcrEngine,
    private val notes: NoteRepository,
    private val settings: SettingsRepository,
    private val router: AIRouter,
    private val bus: WorkflowBus
) {

    /** Run the screenshot pipeline end-to-end. */
    suspend fun handleScreenshotCapture(context: Context): WorkflowState {
        bus.update(WorkflowState.Capturing)
        val bitmap = ScreenshotService.capture(context.applicationContext)
        if (bitmap == null) {
            // No projection consent yet — ask the UI to request it.
            bus.tryEmit(WorkflowBus.Event.RequestProjectionConsent)
            return bus.failed("Screenshot permission required", "capture")
        }
        return try {
            bus.update(WorkflowState.ExtractingText)
            val ocr = ocrEngine.extractText(bitmap)
            if (!ocr.isSuccess || ocr.isEmpty) {
                return bus.failed(ocr.error ?: "Could not read screen", "ocr")
            }
            finishWithText(
                source     = "screenshot",
                rawText    = ocr.rawText.ifBlank { ocr.cleanText },
                cleanText  = ocr.cleanText.ifBlank { ocr.rawText },
                imagePath  = "",
                builder    = { AIPrompts.screenshotSummary(it) },
                ocrConfidence = ocr.confidence
            )
        } finally {
            runCatching { bitmap.recycle() }
        }
    }

    /** Run the voice pipeline given a finished transcript. */
    suspend fun handleVoiceTranscript(transcript: String): WorkflowState {
        if (transcript.isBlank()) {
            return bus.failed("Empty transcript", "voice")
        }
        return finishWithText(
            source = "voice",
            rawText = transcript,
            cleanText = transcript,
            imagePath = "",
            builder = { AIPrompts.voiceSummary(it) }
        )
    }

    /** Save an entirely manual note without any AI step. */
    suspend fun saveManualNote(title: String, content: String): WorkflowState {
        bus.update(WorkflowState.Saving)
        val note = Note(
            title = title.ifBlank { "Untitled note" },
            content = content,
            summary = "",
            sourceType = "manual"
        )
        val id = notes.insertNote(note)
        val saved = note.copy(id = id)
        bus.update(WorkflowState.Done(saved))
        return WorkflowState.Done(saved)
    }

    /** Trigger a voice capture from a non-UI context (the floating service). */
    fun requestVoiceFromService(@Suppress("UNUSED_PARAMETER") context: Context) {
        bus.tryEmit(WorkflowBus.Event.RequestVoiceCapture)
    }

    /* ------------------------------------------------------------------ */

    @Suppress("UNUSED_PARAMETER")
    private suspend fun finishWithText(
        source: String,
        rawText: String,
        cleanText: String,
        imagePath: String,
        builder: (String) -> String,
        ocrConfidence: Float = 1f
    ): WorkflowState {
        val s = settings.settings.first()
        val parsed: ParsedNote = if (s.autoSummarize) {
            bus.update(WorkflowState.AiProcessing)
            val response = router.complete(builder(cleanText))
            if (response.isSuccess) {
                NoteAIHelper.parseAiJson(response.text)
                    ?: NoteAIHelper.parseFromRawText(cleanText)
            } else {
                Log.w(TAG, "AI failed: ${response.error}")
                NoteAIHelper.parseFromRawText(cleanText)
            }
        } else {
            NoteAIHelper.parseFromRawText(cleanText)
        }

        bus.update(WorkflowState.Saving)
        val note = Note(
            title       = parsed.title,
            content     = if (parsed.bullets.isNotEmpty())
                              parsed.toMarkdown() + "\n\n---\n" + cleanText
                          else cleanText,
            summary     = parsed.summary,
            sourceType  = source,
            tags        = listOfNotNull(
                if (source == "screenshot") "screenshot" else "voice",
                if (ocrConfidence in 0f..0.5f) "low-confidence" else null
            ).joinToString(","),
            rawImagePath = imagePath
        )
        val id = notes.insertNote(note)
        val saved = note.copy(id = id)
        bus.update(WorkflowState.Done(saved))
        return WorkflowState.Done(saved)
    }

    private fun WorkflowBus.failed(error: String, step: String): WorkflowState {
        val s = WorkflowState.Failed(error, step)
        update(s)
        return s
    }

    private companion object { const val TAG = "NexOS/Orchestrator" }
}
