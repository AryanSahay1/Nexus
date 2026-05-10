package com.nexus.app.domain.auth

/**
 * Sentinel value the secure store carries when the user has opted into
 * Assistive Mode without providing a real OpenAI API key.
 *
 * - `RootViewModel` treats any non-empty value (including this marker) as
 *   "onboarded" so we don't bounce the user back to onboarding.
 * - `OpenAiService.chatCompletion` recognises the marker and returns a
 *   clean `UNAUTHORIZED` error instead of sending the marker upstream as a
 *   real key.
 *
 * Lives in the domain layer so both `data/` and `ui/` can reference it
 * without one layer depending on the other.
 */
const val ASSISTIVE_ONLY_MARKER: String = "sk-assistive-only-no-real-key"
