package com.nexos.ai.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VoiceInputManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    sealed class Event {
        data object Ready : Event()
        data object BeginningOfSpeech : Event()
        data class  Partial(val text: String) : Event()
        data class  Final(val text: String) : Event()
        data class  Error(val code: Int, val message: String) : Event()
        data object EndOfSpeech : Event()
    }

    private val main = Handler(Looper.getMainLooper())
    private val channel = Channel<Event>(capacity = Channel.UNLIMITED)
    val events: Flow<Event> = channel.receiveAsFlow()

    private var recognizer: SpeechRecognizer? = null

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    fun start() {
        // SpeechRecognizer MUST live on the main thread.
        main.post {
            if (!isAvailable()) {
                channel.trySend(Event.Error(SpeechRecognizer.ERROR_CLIENT, "Speech recognition not available"))
                return@post
            }
            destroyInternal()
            recognizer = SpeechRecognizer.createSpeechRecognizer(context).also { rec ->
                rec.setRecognitionListener(listener)
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                }
                rec.startListening(intent)
            }
        }
    }

    fun stop() {
        main.post { runCatching { recognizer?.stopListening() } }
    }

    fun cancel() {
        main.post {
            runCatching { recognizer?.cancel() }
            destroyInternal()
        }
    }

    private fun destroyInternal() {
        runCatching { recognizer?.destroy() }
        recognizer = null
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) { channel.trySend(Event.Ready) }
        override fun onBeginningOfSpeech() { channel.trySend(Event.BeginningOfSpeech) }
        override fun onRmsChanged(rmsdB: Float) { /* unused; future: feed amplitude UI */ }
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() { channel.trySend(Event.EndOfSpeech) }

        override fun onError(error: Int) {
            channel.trySend(Event.Error(error, errorMessageOf(error)))
            destroyInternal()
        }

        override fun onResults(results: Bundle?) {
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull().orEmpty()
            channel.trySend(Event.Final(text))
            destroyInternal()
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull().orEmpty()
            if (text.isNotBlank()) channel.trySend(Event.Partial(text))
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private fun errorMessageOf(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO              -> "Audio error"
        SpeechRecognizer.ERROR_CLIENT             -> "Client error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission denied"
        SpeechRecognizer.ERROR_NETWORK            -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT    -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH           -> "No speech recognized"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY    -> "Recognizer busy"
        SpeechRecognizer.ERROR_SERVER             -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT     -> "Speech timed out"
        else                                      -> "Unknown error ($code)"
    }

    private companion object { const val TAG = "NexOS/VoiceInputManager" }
}
