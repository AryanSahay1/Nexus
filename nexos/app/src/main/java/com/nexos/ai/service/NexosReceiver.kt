package com.nexos.ai.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.nexos.ai.util.NexosOrchestrator
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@AndroidEntryPoint
class NexosReceiver : BroadcastReceiver() {

    @Inject lateinit var orchestrator: NexosOrchestrator

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_CAPTURE_SCREENSHOT -> {
                Log.i(TAG, "ACTION_CAPTURE_SCREENSHOT")
                scope.launch { orchestrator.handleScreenshotCapture(context) }
            }
            ACTION_START_VOICE -> {
                Log.i(TAG, "ACTION_START_VOICE")
                orchestrator.requestVoiceFromService(context)
            }
            ACTION_TOGGLE_BUTTON -> {
                Log.i(TAG, "ACTION_TOGGLE_BUTTON")
                FloatingButtonService.toggle(context)
            }
        }
    }

    companion object {
        private const val TAG = "NexOS/NexosReceiver"
        const val ACTION_CAPTURE_SCREENSHOT = "com.nexos.ACTION_CAPTURE_SCREENSHOT"
        const val ACTION_START_VOICE        = "com.nexos.ACTION_START_VOICE"
        const val ACTION_TOGGLE_BUTTON      = "com.nexos.ACTION_TOGGLE_BUTTON"
    }
}
