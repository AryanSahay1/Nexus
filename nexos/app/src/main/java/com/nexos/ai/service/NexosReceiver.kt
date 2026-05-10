package com.nexos.ai.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.nexos.ai.util.NexosOrchestrator
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class NexosReceiver : BroadcastReceiver() {

    @Inject lateinit var orchestrator: NexosOrchestrator
    @Inject lateinit var screenshotController: ScreenshotController

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            ACTION_CAPTURE_SCREENSHOT -> {
                if (!screenshotController.isReady) {
                    Log.w(TAG, "Capture requested but no MediaProjection grant — opening main activity")
                    orchestrator.requestProjectionConsent(context)
                    return
                }
                val svc = Intent(context, ScreenshotService::class.java)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(svc)
                } else {
                    context.startService(svc)
                }
            }

            ACTION_START_VOICE -> {
                scope.launch { orchestrator.startVoiceCapture() }
            }

            ACTION_TOGGLE_FLOATING -> {
                orchestrator.toggleFloatingButton(context)
            }

            else -> Log.w(TAG, "Unhandled action: ${intent?.action}")
        }
    }

    companion object {
        const val ACTION_CAPTURE_SCREENSHOT = "com.nexos.ACTION_CAPTURE_SCREENSHOT"
        const val ACTION_START_VOICE = "com.nexos.ACTION_START_VOICE"
        const val ACTION_TOGGLE_FLOATING = "com.nexos.ACTION_TOGGLE_FLOATING"
        private const val TAG = "NexOS/NexosReceiver"
    }
}
