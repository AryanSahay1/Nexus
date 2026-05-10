package com.nexus.app.data.intents

import android.content.Intent
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.MediaStore
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DeepLinksTest {

    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun `unknown action yields a null intent and a structured error`() {
        assertThat(DeepLinks.resolve(context, "open_random_app_42")).isNull()

        val launch = DeepLinks.launch(context, "open_random_app_42")
        assertThat(launch.errorOrNull()?.message).contains("don't know how to open")
    }

    @Test
    fun `open_dialer is ACTION_DIAL`() {
        val intent = DeepLinks.resolve(context, "open_dialer")!!
        assertThat(intent.action).isEqualTo(Intent.ACTION_DIAL)
    }

    @Test
    fun `open_camera uses the standard IMAGE_CAPTURE action`() {
        val intent = DeepLinks.resolve(context, "open_camera")!!
        assertThat(intent.action).isEqualTo(MediaStore.ACTION_IMAGE_CAPTURE)
    }

    @Test
    fun `open_calendar inserts into the events content uri`() {
        val intent = DeepLinks.resolve(context, "open_calendar")!!
        assertThat(intent.action).isEqualTo(Intent.ACTION_INSERT)
        assertThat(intent.data).isEqualTo(CalendarContract.Events.CONTENT_URI)
    }

    @Test
    fun `open_contacts views the contacts content uri`() {
        val intent = DeepLinks.resolve(context, "open_contacts")!!
        assertThat(intent.action).isEqualTo(Intent.ACTION_VIEW)
        assertThat(intent.data).isEqualTo(ContactsContract.Contacts.CONTENT_URI)
    }

    @Test
    fun `app deep-links fall back to a Play Store URI when not installed`() {
        // Robolectric environment has no Gmail installed → expect Play Store URI.
        val intent = DeepLinks.resolve(context, "open_gmail")!!
        assertThat(intent.action).isEqualTo(Intent.ACTION_VIEW)
        assertThat(intent.data?.scheme).isEqualTo("market")
        assertThat(intent.data?.toString()).contains("com.google.android.gm")
    }

    @Test
    fun `SUPPORTED set covers every action the resolver handles`() {
        DeepLinks.SUPPORTED.forEach { action ->
            assertThat(DeepLinks.resolve(context, action)).isNotNull()
        }
    }
}
