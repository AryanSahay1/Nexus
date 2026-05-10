package com.nexus.app.data.learn

/**
 * One curriculum entry the **Assistive Mode** can teach without any API key,
 * any cloud service, or any sensitive permission. Each tutorial is a sequence
 * of [TutorialStep]s that the user can read at their own pace, optionally
 * with a deep-link button that opens the relevant system app at exactly the
 * right place ("Open Gmail", "Open Contacts", etc.).
 *
 * The whole point of this content is that elderly users (and users new to
 * smartphones in general) can learn the steps for everyday tasks — writing
 * an email, adding a calendar event, saving a phone number — *inside Nexus
 * itself*. No external account, no network call, no Google scope.
 */
data class Tutorial(
    val id: String,
    val category: TutorialCategory,
    val title: String,
    val subtitle: String,
    val estimatedMinutes: Int,
    val steps: List<TutorialStep>
)

enum class TutorialCategory(val displayName: String, val description: String) {
    Email(
        displayName = "Email",
        description = "Reading, writing, and replying to email."
    ),
    Calendar(
        displayName = "Calendar",
        description = "Adding appointments, reminders, and birthdays."
    ),
    Contacts(
        displayName = "Contacts",
        description = "Saving, finding, and editing phone numbers."
    ),
    Phone(
        displayName = "Phone basics",
        description = "Calling, the camera, photos, and Wi-Fi."
    ),
    Social(
        displayName = "Social media",
        description = "Sharing photos, posting safely, and avoiding scams."
    )
}

/**
 * A single instructional step.
 *
 * @param body            Plain-text body shown in the tutorial player. Kept
 *                        deliberately short and concrete (one action per step)
 *                        so it works well with TalkBack and large-text mode.
 * @param tip             Optional gentle reminder shown beneath the body.
 * @param actionLabel     Optional label for the deep-link button. When
 *                        present the player will offer to open the relevant
 *                        system app via the [actionIntent] key.
 * @param actionIntent    Identifier resolved by `DeepLinks` at click time —
 *                        we keep it as a string so the registry stays a pure
 *                        Kotlin module with no Android-context dependency.
 */
data class TutorialStep(
    val body: String,
    val tip: String? = null,
    val actionLabel: String? = null,
    val actionIntent: String? = null
)
