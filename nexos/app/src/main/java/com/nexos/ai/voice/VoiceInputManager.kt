package com.nexos.ai.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps [SpeechRecognizer] with a coroutine-friendly API.
 *
 * SpeechRecognizer instances *must* be created and released on the main thread.
 */
@Singleton
class VoiceInputManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    sealed class State {
        data object Idle : State()
        data object Listening : State()
        data class Partial(val text: String) : State()
        data class Result(val text: String) : State()
        data class Failed(val error: String) : State()
    }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    private var recognizer: SpeechRecognizer? = null

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    suspend fun start(language: String = "en-US") = withContext(Dispatchers.Main) {
        if (!isAvailable()) {
            _state.value = State.Failed("Speech recognition unavailable on this device")
            return@withContext
        }
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(buildListener())
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        _state.value = State.Listening
        recognizer?.startListening(intent)
    }

    suspend fun stop() = withContext(Dispatchers.Main) {
        recognizer?.stopListening()
    }

    suspend fun release() = withContext(Dispatchers.Main) {
        recognizer?.destroy()
        recognizer = null
        _state.value = State.Idle
    }

    private fun buildListener() = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onPartialResults(partialResults: Bundle?) {
            val texts = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
            texts.firstOrNull()?.takeIf { it.isNotBlank() }?.let {
                _state.value = State.Partial(it)
            }
        }

        override fun onResults(results: Bundle?) {
            val texts = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
            val final = texts.firstOrNull().orEmpty()
            _state.value = if (final.isNotBlank()) State.Result(final)
            else State.Failed("No speech detected")
        }

        override fun onError(error: Int) {
            val msg = mapError(error)
            Log.w(TAG, "Speech error: $msg ($error)")
            _state.value = State.Failed(msg)
        }
    }

    private fun mapError(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT -> "Client error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission required"
        SpeechRecognizer.ERROR_NETWORK -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH -> "No speech matched"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer is busy"
        SpeechRecognizer.ERROR_SERVER -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
        else -> "Unknown error ($code)"
    }

    private companion object {
        const val TAG = "NexOS/VoiceInputManager"
    }
}
