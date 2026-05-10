package com.nexos.ai.ocr

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.nexos.ai.domain.model.OcrResult
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

@Singleton
class OcrEngine @Inject constructor() {

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun extractText(bitmap: Bitmap): OcrResult = try {
        val image = InputImage.fromBitmap(bitmap, 0)
        suspendCancellableCoroutine { cont ->
            recognizer.process(image)
                .addOnSuccessListener { result ->
                    val raw = result.text
                    val blocks = result.textBlocks.map { it.text }
                    val confidence = if (blocks.isNotEmpty()) 0.9f else 0.0f
                    cont.resume(
                        OcrResult(
                            rawText = raw,
                            cleanText = TextCleaner.clean(raw),
                            blocks = blocks,
                            confidence = confidence,
                            isSuccess = raw.isNotBlank(),
                            error = if (raw.isBlank()) "No text detected" else null,
                        )
                    )
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "OCR failed", e)
                    cont.resume(
                        OcrResult(
                            rawText = "",
                            cleanText = "",
                            blocks = emptyList(),
                            confidence = 0f,
                            isSuccess = false,
                            error = e.message ?: "Unknown OCR error",
                        )
                    )
                }
        }
    } catch (t: Throwable) {
        Log.e(TAG, "OCR setup failed", t)
        OcrResult("", "", emptyList(), 0f, false, t.message)
    }

    private companion object {
        const val TAG = "NexOS/OcrEngine"
    }
}
