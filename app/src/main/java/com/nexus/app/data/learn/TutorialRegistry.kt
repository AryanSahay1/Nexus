package com.nexus.app.data.learn

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Hard-coded curriculum for **Assistive Mode**.
 *
 * All copy lives in code (not strings.xml) on purpose: each step is verbose,
 * uses sentence-case punctuation, and the registry is going to grow with new
 * tutorials over time. Keeping it in Kotlin makes adding/editing a tutorial
 * a one-file change. Translations would be wired later via a per-locale
 * registry that reads the same shape.
 *
 * NONE of these tutorials touch the network, ask for an API key, or request
 * a sensitive Android permission. They teach the user how to use the system
 * apps that are already on their phone.
 */
@Singleton
class TutorialRegistry @Inject constructor() {

    fun all(): List<Tutorial> = catalog

    fun byId(id: String): Tutorial? = catalog.firstOrNull { it.id == id }

    fun byCategory(category: TutorialCategory): List<Tutorial> =
        catalog.filter { it.category == category }

    private val catalog: List<Tutorial> = listOf(
        Tutorial(
            id = "email_first_message",
            category = TutorialCategory.Email,
            title = "Write your first email",
            subtitle = "We'll walk through opening Gmail and sending a short message.",
            estimatedMinutes = 4,
            steps = listOf(
                TutorialStep(
                    body = "Tap the button below to open the Gmail app on your phone.",
                    tip = "Gmail's icon is the colourful M-shape. If it's not on your home screen, look in the app drawer.",
                    actionLabel = "Open Gmail",
                    actionIntent = "open_gmail"
                ),
                TutorialStep(
                    body = "Inside Gmail, tap the round pencil button in the bottom-right corner. That's the \"Compose\" button.",
                    tip = "If you don't see the pencil, scroll up — it sits just above your inbox."
                ),
                TutorialStep(
                    body = "In the \"To\" line, type the email address of the person you're writing to, then a comma to confirm it.",
                    tip = "Email addresses always contain an @ sign. For example: jane@example.com"
                ),
                TutorialStep(
                    body = "Tap the \"Subject\" line and write a short summary, like \"Hello\" or \"Quick question\". This helps the other person know what the email is about."
                ),
                TutorialStep(
                    body = "Tap the big empty space below the subject. Type your message — short is fine. End with your name."
                ),
                TutorialStep(
                    body = "When you're ready, tap the paper-aeroplane icon in the top-right corner. That sends your email.",
                    tip = "If you change your mind, tap the back arrow first — Gmail will offer to save a draft."
                )
            )
        ),
        Tutorial(
            id = "email_reply_safely",
            category = TutorialCategory.Email,
            title = "Reply to an email (and spot scams)",
            subtitle = "Most spam looks legitimate. Here's how to read carefully and reply only to people you know.",
            estimatedMinutes = 5,
            steps = listOf(
                TutorialStep(
                    body = "Open Gmail. Tap any message you want to read.",
                    actionLabel = "Open Gmail",
                    actionIntent = "open_gmail"
                ),
                TutorialStep(
                    body = "Look at the sender's email address — not just the name. If it doesn't look like a real company (lots of random letters and numbers), it's probably a scam.",
                    tip = "Real banks and Government departments never ask for your password by email."
                ),
                TutorialStep(
                    body = "If the message asks you to click a link to \"verify your account\" or \"unlock\" something, do not click. Close the email and tell a family member."
                ),
                TutorialStep(
                    body = "If the email is from someone you know, tap the curved-arrow button at the bottom — that's \"Reply\". Type a short response."
                ),
                TutorialStep(
                    body = "Tap the paper-aeroplane to send your reply."
                )
            )
        ),
        Tutorial(
            id = "calendar_first_event",
            category = TutorialCategory.Calendar,
            title = "Add a doctor's appointment to your calendar",
            subtitle = "We'll create a calendar event so your phone reminds you in time.",
            estimatedMinutes = 3,
            steps = listOf(
                TutorialStep(
                    body = "Tap the button to open Google Calendar.",
                    actionLabel = "Open Calendar",
                    actionIntent = "open_calendar"
                ),
                TutorialStep(
                    body = "Tap the round + button in the bottom-right corner. Then choose \"Event\".",
                    tip = "If a menu pops up, look for the icon with a dot — that's a regular event."
                ),
                TutorialStep(
                    body = "Type a short title, like \"Doctor's appointment\". This is what you'll see on the day."
                ),
                TutorialStep(
                    body = "Tap the date and pick the day. Tap the time and pick the start time. The end time fills in automatically.",
                    tip = "If it's an all-day event (like a birthday), there's a switch labelled \"All-day\" — turn it on."
                ),
                TutorialStep(
                    body = "Below that, look for a row that says \"Notification\" or a bell icon. Tap it and choose \"30 minutes before\" so your phone reminds you ahead of time."
                ),
                TutorialStep(
                    body = "Tap \"Save\" in the top-right corner. Done."
                )
            )
        ),
        Tutorial(
            id = "contacts_save_number",
            category = TutorialCategory.Contacts,
            title = "Save a new phone number",
            subtitle = "Once a number is in your contacts, you can call them just by tapping their name.",
            estimatedMinutes = 3,
            steps = listOf(
                TutorialStep(
                    body = "Tap the button to open your Contacts app.",
                    actionLabel = "Open Contacts",
                    actionIntent = "open_contacts"
                ),
                TutorialStep(
                    body = "Tap the round + button (or the \"Add\" button at the top, depending on your phone)."
                ),
                TutorialStep(
                    body = "Type the person's first name. Tap the next field and type their last name."
                ),
                TutorialStep(
                    body = "Tap the \"Phone\" field and type their phone number. Include the country code if they're not in your country (for India that's +91, for the UK +44)."
                ),
                TutorialStep(
                    body = "Tap \"Save\" or the tick (✓) button at the top-right. The contact is saved."
                ),
                TutorialStep(
                    body = "From now on, you can find them by typing the start of their name in the Contacts search box."
                )
            )
        ),
        Tutorial(
            id = "contacts_edit_number",
            category = TutorialCategory.Contacts,
            title = "Change a phone number you already saved",
            subtitle = "If a friend or family member changes their number, here's how to update it.",
            estimatedMinutes = 2,
            steps = listOf(
                TutorialStep(
                    body = "Open Contacts.",
                    actionLabel = "Open Contacts",
                    actionIntent = "open_contacts"
                ),
                TutorialStep(
                    body = "Find the person — either by scrolling, or by tapping the magnifying glass and typing their name."
                ),
                TutorialStep(
                    body = "Tap their name to open their card. Tap the pencil icon at the top — that means \"Edit\"."
                ),
                TutorialStep(
                    body = "Tap on the old phone number. Use backspace (the ⌫ key on the keyboard) to delete the old digits, then type the new number."
                ),
                TutorialStep(
                    body = "Tap \"Save\" or the tick button. The contact now has the new number everywhere — calls, messages, WhatsApp."
                )
            )
        ),
        Tutorial(
            id = "phone_make_call",
            category = TutorialCategory.Phone,
            title = "Make a phone call",
            subtitle = "Two ways: from Contacts (if you've saved them), or by dialling.",
            estimatedMinutes = 2,
            steps = listOf(
                TutorialStep(
                    body = "If the person is already in your contacts, open Contacts and tap their name, then tap the phone icon.",
                    actionLabel = "Open Contacts",
                    actionIntent = "open_contacts"
                ),
                TutorialStep(
                    body = "Otherwise, open the Phone (or Dialler) app.",
                    actionLabel = "Open Phone",
                    actionIntent = "open_dialer"
                ),
                TutorialStep(
                    body = "Tap the keypad icon at the bottom. Type the number. Then tap the green call button."
                ),
                TutorialStep(
                    body = "When you're finished, tap the red button to hang up.",
                    tip = "If you can't hear well, the volume buttons on the side of your phone make it louder."
                )
            )
        ),
        Tutorial(
            id = "phone_take_photo",
            category = TutorialCategory.Phone,
            title = "Take a photo and share it",
            subtitle = "Open the Camera, take a picture, then send it to someone.",
            estimatedMinutes = 3,
            steps = listOf(
                TutorialStep(
                    body = "Tap the Camera app to open it.",
                    actionLabel = "Open Camera",
                    actionIntent = "open_camera"
                ),
                TutorialStep(
                    body = "Point the phone at what you want to photograph. Tap the big round button at the bottom — that's the shutter."
                ),
                TutorialStep(
                    body = "To see the photo you just took, tap the small thumbnail in the corner."
                ),
                TutorialStep(
                    body = "To send it: tap the share icon (it looks like three dots connected by lines). Pick where to send it — WhatsApp, message, email."
                )
            )
        ),
        Tutorial(
            id = "social_post_safely",
            category = TutorialCategory.Social,
            title = "Post a photo on Facebook or Instagram safely",
            subtitle = "Decide what's public, what's private, and what stays just between family.",
            estimatedMinutes = 4,
            steps = listOf(
                TutorialStep(
                    body = "Before you post, ask: would I be OK if a stranger saw this in 5 years? If yes, continue. If unsure, share it as a private message instead."
                ),
                TutorialStep(
                    body = "Open the social app you use most (Facebook, Instagram, WhatsApp Status)."
                ),
                TutorialStep(
                    body = "Tap the + or \"Create\" button. Pick the photo from your gallery."
                ),
                TutorialStep(
                    body = "Look for the audience selector — usually a small label that says \"Public\", \"Friends\", or \"Only me\". Tap it and choose \"Friends\" to keep it semi-private.",
                    tip = "Once you post, a screenshot can be shared anywhere. Treat every public post as permanent."
                ),
                TutorialStep(
                    body = "Write a short caption if you'd like. Then tap \"Share\" or \"Post\"."
                )
            )
        )
    )
}
