package com.nexos.ai.ai

object AIPrompts {
    fun screenshotSummary(rawText: String): String = """
        You are a note-taking assistant. The following text was extracted from a screenshot via OCR.
        Create a structured note from this content.

        Respond ONLY with valid JSON in this exact format:
        {
          "title": "concise title under 8 words",
          "bullets": ["key point 1", "key point 2", "key point 3"],
          "summary": "one sentence summary"
        }

        Rules:
        - Title must be under 8 words
        - 3 to 6 bullet points maximum
        - Summary must be one sentence
        - No markdown, no extra text — ONLY the JSON object

        Raw OCR text:
        $rawText
    """.trimIndent()

    fun voiceSummary(transcript: String): String = """
        You are a note-taking assistant. Convert this voice transcript into a structured note.

        Respond ONLY with valid JSON:
        {
          "title": "concise title under 8 words",
          "bullets": ["key point 1", "key point 2"],
          "summary": "one sentence summary"
        }

        Transcript: $transcript
    """.trimIndent()
}
