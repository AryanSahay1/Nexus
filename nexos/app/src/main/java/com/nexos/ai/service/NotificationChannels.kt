package com.nexos.ai.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context

internal object NotificationChannels {
    const val FLOATING = "nexos_floating"
    const val CAPTURE = "nexos_capture"

    fun ensure(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(FLOATING, "NexOS Floating Button", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Background floating capture bubble"
                setShowBadge(false)
            }
        )
        manager.createNotificationChannel(
            NotificationChannel(CAPTURE, "NexOS Screen Capture", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Active screen capture sessions"
            }
        )
    }
}
