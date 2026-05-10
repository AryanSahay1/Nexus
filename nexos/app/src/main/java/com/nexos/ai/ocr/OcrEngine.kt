package com.nexos.ai.ocr

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.nexos.ai.domain.model.OcrResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

@Singleton
class OcrEngine @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val recognizer: TextRecognizer = TextRecognition.getClient(
        TextRecognizerOptions.DEFAULT_OPTIONS
    )

    suspend fun extractText(bitmap: Bitmap): OcrResult = withContext(Dispatchers.Default) {
        try {
            val image = InputImage.fromBitmap(bitmap, 0)
            val result = suspendCancellableCoroutine<com.google.mlkit.vision.text.Text> { cont ->
                recognizer.process(image)
                    .addOnSuccessListener { cont.resume(it) }
                    .addOnFailureListener { cont.resumeWith(Result.failure(it)) }
            }
            OcrResult(
                rawText    = result.text,
                cleanText  = TextCleaner.clean(result),
                blocks     = TextCleaner.blocks(result),
                confidence = TextCleaner.averageConfidence(result),
                isSuccess  = true
            )
        } catch (e: Exception) {
            Log.e(TAG, "OCR failed", e)
            OcrResult.failure(e.message ?: "OCR error")
        }
    }

    private companion object { const val TAG = "NexOS/OcrEngine" }
}
