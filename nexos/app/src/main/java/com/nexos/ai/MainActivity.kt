package com.nexos.ai

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.core.view.WindowCompat
import com.nexos.ai.presentation.ui.NexosApp
import com.nexos.ai.presentation.ui.theme.NexosTheme
import com.nexos.ai.presentation.viewmodel.NotesViewModel
import com.nexos.ai.service.ScreenshotController
import com.nexos.ai.service.ScreenshotService
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var screenshotController: ScreenshotController

    private val notesViewModel: NotesViewModel by viewModels()

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data ?: return@registerForActivityResult
            screenshotController.saveProjectionGrant(result.resultCode, data)
            // Immediately fire the capture service the user just consented to
            val svc = Intent(this, ScreenshotService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc)
            else startService(svc)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        setContent {
            NexosTheme(darkTheme = true) {
                val pendingVoiceTrigger = remember { mutableStateOf(intent?.action == ACTION_START_VOICE) }
                LaunchedEffect(intent?.action) {
                    if (intent?.action == ACTION_REQUEST_PROJECTION) {
                        requestProjection()
                    }
                }
                NexosApp(
                    notesViewModel = notesViewModel,
                    onRequestProjection = ::requestProjection,
                    onToggleFloating = ::toggleFloating,
                    autoOpenVoice = pendingVoiceTrigger.value,
                    onVoiceConsumed = { pendingVoiceTrigger.value = false },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.action == ACTION_REQUEST_PROJECTION) requestProjection()
    }

    private fun requestProjection() {
        val pm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projectionLauncher.launch(pm.createScreenCaptureIntent())
    }

    private fun toggleFloating() {
        notesViewModel.orchestrator.toggleFloatingButton(this)
    }

    companion object {
        const val ACTION_REQUEST_PROJECTION = "com.nexos.ACTION_REQUEST_PROJECTION"
        const val ACTION_START_VOICE = "com.nexos.ACTION_START_VOICE"
    }
}
