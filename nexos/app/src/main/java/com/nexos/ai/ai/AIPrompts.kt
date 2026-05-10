package com.nexos.ai.ai

object AIPrompts {

    fun screenshotSummary(rawText: String): String = """
        You are a precise note-taking assistant. The following text was extracted
        from a screenshot via on-device OCR and may contain spurious line breaks
        and minor OCR errors. Produce a clean, structured note.

        Respond with ONLY a valid JSON object — no markdown, no commentary —
        matching this schema exactly:
        {
          "title": "concise title under 8 words",
          "bullets": ["key point 1", "key point 2", "key point 3"],
          "summary": "one sentence summary"
        }

        Constraints:
        - title: <= 8 words, Title Case, no trailing punctuation
        - bullets: 3 to 6 items, each <= 18 words
        - summary: exactly one sentence

        Raw OCR text:
        ${rawText.take(8_000)}
    """.trimIndent()

    fun voiceSummary(transcript: String): String = """
        You are a precise note-taking assistant. Convert this voice transcript
        into a structured note.

        Respond with ONLY a valid JSON object — no markdown, no commentary —
        matching this schema exactly:
        {
          "title": "concise title under 8 words",
          "bullets": ["key point 1", "key point 2"],
          "summary": "one sentence summary"
        }

        Transcript:
        ${transcript.take(8_000)}
    """.trimIndent()
}
