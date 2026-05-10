package com.nexus.app.data.intents

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.MediaStore
import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult

/**
 * Helpers that resolve the symbolic intent ids used by the tutorial registry
 * to real Android `Intent`s. Each helper either returns a launchable Intent
 * (so the caller can `startActivity` it) or a `NexusError` if the system
 * app isn't available.
 *
 * These are **read-only deep-links into apps already on the user's phone**.
 * They do not touch the network and do not require any sensitive permission.
 */
object DeepLinks {

    /** All the symbolic actions the tutorial registry is allowed to use. */
    val SUPPORTED: Set<String> = setOf(
        "open_gmail",
        "open_calendar",
        "open_contacts",
        "open_dialer",
        "open_camera",
        "open_whatsapp"
    )

    /**
     * Builds a launchable intent for [action]. For app-specific actions
     * (Gmail, WhatsApp) we first try the installed-app launcher intent and
     * fall back to a Play Store URI if the app isn't installed yet — that
     * way the tutorial gracefully nudges the user to install instead of
     * silently failing.
     */
    fun resolve(context: Context, action: String): Intent? = when (action) {
        "open_gmail" -> appOrPlayStoreIntent(context, "com.google.android.gm")
        "open_calendar" -> CALENDAR_INSERT_INTENT
        "open_contacts" -> CONTACTS_INTENT
        "open_dialer" -> Intent(Intent.ACTION_DIAL)
        "open_camera" -> Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        "open_whatsapp" -> appOrPlayStoreIntent(context, "com.whatsapp")
        else -> null
    }

    /**
     * Convenience for `Activity` callers — looks up the intent and either
     * starts it or returns a structured error so the UI can show a polite
     * message instead of crashing.
     */
    fun launch(context: Context, action: String): NexusResult<Unit> {
        val intent = resolve(context, action)
            ?: return NexusResult.err(
                NexusError(NexusErrorCode.NOT_FOUND, "I don't know how to open '$action' yet.")
            )
        if (intent.resolveActivity(context.packageManager) == null) {
            return NexusResult.err(
                NexusError(
                    NexusErrorCode.NOT_FOUND,
                    "That app isn't on this phone. You can install it from the Play Store."
                )
            )
        }
        return runCatching {
            context.startActivity(intent.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
            NexusResult.ok(Unit)
        }.getOrElse {
            NexusResult.err(
                NexusError(NexusErrorCode.UNKNOWN, it.message ?: "Couldn't open the app.")
            )
        }
    }

    // Intents are constructed lazily so that referencing the Kotlin
    // `object` from a non-Android JUnit test (e.g. TutorialRegistryTest)
    // does not run them through the Intent stubs that throw at class init.
    private val CALENDAR_INSERT_INTENT: Intent by lazy {
        Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
    }

    private val CONTACTS_INTENT: Intent by lazy {
        Intent(Intent.ACTION_VIEW).setData(ContactsContract.Contacts.CONTENT_URI)
    }

    private fun appOrPlayStoreIntent(context: Context, packageName: String): Intent {
        val launcher = context.packageManager.getLaunchIntentForPackage(packageName)
        return launcher ?: Intent(Intent.ACTION_VIEW)
            .setData(Uri.parse("market://details?id=$packageName"))
    }
}
