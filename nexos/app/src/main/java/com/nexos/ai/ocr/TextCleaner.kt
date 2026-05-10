package com.nexos.ai.ocr

import com.google.mlkit.vision.text.Text

/**
 * Post-processes ML Kit OCR output into something useful for AI prompts and notes.
 * The OCR result contains layout blocks; we keep them as separate paragraphs and
 * collapse hard line wraps inside each one.
 */
object TextCleaner {

    fun clean(text: Text): String = buildString {
        text.textBlocks.forEachIndexed { i, block ->
            val joined = block.lines.joinToString(separator = " ") { line -> line.text.trim() }
                .replace(Regex("\\s+"), " ")
                .trim()
            if (joined.isNotEmpty()) {
                if (i > 0) append("\n\n")
                append(joined)
            }
        }
    }

    /** Best-effort confidence based on per-element confidence (ML Kit gives 0..1 per element). */
    fun averageConfidence(text: Text): Float {
        val values = text.textBlocks.flatMap { b ->
            b.lines.flatMap { l -> l.elements.map { it.confidence } }
        }
        if (values.isEmpty()) return 0f
        return values.sum() / values.size
    }

    fun blocks(text: Text): List<String> = text.textBlocks
        .map { it.lines.joinToString(" ") { l -> l.text.trim() }.trim() }
        .filter { it.isNotEmpty() }
}
