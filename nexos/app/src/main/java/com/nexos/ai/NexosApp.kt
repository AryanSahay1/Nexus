package com.nexos.ai

import android.app.Application
import com.nexos.ai.service.NotificationChannels
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class NexosApp : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationChannels.ensure(this)
    }
}
