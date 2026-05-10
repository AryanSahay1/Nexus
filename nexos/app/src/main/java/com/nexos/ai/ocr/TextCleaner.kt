package com.nexos.ai.ocr

object TextCleaner {

    private val multiSpace = Regex("[ \\t]{2,}")
    private val multiNewline = Regex("\\n{3,}")
    private val orphanLineEnding = Regex("(?<=[a-zA-Z,])\\n(?=[a-z])")

    /**
     * Best-effort OCR text cleanup:
     * - collapses multiple spaces / newlines
     * - re-joins broken lines (line ending in lowercase or comma followed by lowercase)
     * - trims edge whitespace
     */
    fun clean(raw: String): String {
        if (raw.isBlank()) return ""
        return raw
            .replace("\r\n", "\n")
            .replace(multiSpace, " ")
            .replace(orphanLineEnding, " ")
            .replace(multiNewline, "\n\n")
            .lineSequence()
            .map { it.trim() }
            .joinToString("\n")
            .trim()
    }
}
