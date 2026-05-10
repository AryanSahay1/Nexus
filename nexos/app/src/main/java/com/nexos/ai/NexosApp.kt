package com.nexos.ai

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class NexosApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java) ?: return

        val service = NotificationChannel(
            CHANNEL_SERVICE,
            "NexOS Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Persistent notification for the floating button."
            setShowBadge(false)
        }
        val workflow = NotificationChannel(
            CHANNEL_WORKFLOW,
            "NexOS Capture",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Notifies when a screenshot or voice note is saved."
        }
        nm.createNotificationChannels(listOf(service, workflow))
    }

    companion object {
        const val CHANNEL_SERVICE = "nexos_service"
        const val CHANNEL_WORKFLOW = "nexos_workflow"
    }
}
