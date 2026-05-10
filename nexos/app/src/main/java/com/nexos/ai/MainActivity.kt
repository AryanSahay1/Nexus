package com.nexos.ai

import android.Manifest
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.nexos.ai.data.repository.SettingsRepository
import com.nexos.ai.presentation.navigation.NexosNavGraph
import com.nexos.ai.presentation.navigation.NexosRoutes
import com.nexos.ai.presentation.ui.theme.NexosTheme
import com.nexos.ai.presentation.ui.voice.VoiceInputBottomSheet
import com.nexos.ai.service.FloatingButtonService
import com.nexos.ai.util.MediaProjectionHolder
import com.nexos.ai.util.WorkflowBus
import com.nexos.ai.util.hasOverlayPermission
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var settingsRepo: SettingsRepository
    @Inject lateinit var bus: WorkflowBus
    @Inject lateinit var projectionHolder: MediaProjectionHolder

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            projectionHolder.store(result.resultCode, data)
        }
    }

    private val notifLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* no-op — purely opportunistic */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            NexosTheme {
                NexosAppRoot()
            }
        }

        lifecycleScope.launch {
            // Start (or refresh) the floating button service if the user enabled it.
            val settings = settingsRepo.settings.first()
            if (settings.showFloatingButton && hasOverlayPermission()) {
                FloatingButtonService.start(this@MainActivity)
            }
        }

        lifecycleScope.launch {
            bus.events.collect { event ->
                when (event) {
                    WorkflowBus.Event.RequestProjectionConsent -> requestProjectionConsent()
                    else -> Unit /* handled inside the compose tree */
                }
            }
        }
    }

    @Composable
    private fun NexosAppRoot() {
        val context = LocalContext.current
        var voiceVisible by rememberSaveable { mutableStateOf(false) }
        var pendingFromService by remember { mutableStateOf(false) }

        // Show voice sheet when service asks for it.
        LaunchedEffect(Unit) {
            bus.events.collect { e ->
                if (e is WorkflowBus.Event.RequestVoiceCapture) {
                    voiceVisible = true
                }
            }
        }

        val startRoute = remember { if (firstLaunchRequiresOnboarding(context)) NexosRoutes.ONBOARDING else NexosRoutes.NOTES }
        NexosNavGraph(startRoute = startRoute)

        if (voiceVisible) {
            VoiceInputBottomSheet(onDismiss = { voiceVisible = false })
        }
    }

    private fun firstLaunchRequiresOnboarding(context: Context): Boolean {
        // If overlay permission is not granted yet, the user has not finished onboarding.
        return !context.hasOverlayPermission()
    }

    private fun requestProjectionConsent() {
        val mgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projectionLauncher.launch(mgr.createScreenCaptureIntent())
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // future deep links can be handled here
    }
}
