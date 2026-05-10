package com.nexos.ai.presentation.ui.onboarding

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nexos.ai.R
import com.nexos.ai.presentation.ui.theme.NexosBackground
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosPrimaryGlow
import com.nexos.ai.util.hasOverlayPermission
import com.nexos.ai.util.hasPermission
import com.nexos.ai.util.isIgnoringBatteryOptimization
import kotlin.math.sin

private data class Step(
    val icon: ImageVector,
    val titleRes: Int,
    val bodyRes: Int,
    val isGranted: (Context) -> Boolean,
    val request: (Context, ((Boolean) -> Unit)?) -> Unit,
    val optional: Boolean = false
)

@Composable
fun OnboardingScreen(onFinished: () -> Unit) {
    val context = LocalContext.current
    var index by rememberSaveable { mutableIntStateOf(0) }

    val audioLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }
    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    val steps = remember {
        listOf(
            Step(
                icon = Icons.Default.AutoAwesome,
                titleRes = R.string.app_tagline,
                bodyRes  = R.string.empty_notes_body,
                isGranted = { true },
                request = { _, _ -> }
            ),
            Step(
                icon = Icons.Default.Layers,
                titleRes = R.string.perm_overlay,
                bodyRes  = R.string.perm_overlay_body,
                isGranted = { it.hasOverlayPermission() },
                request = { ctx, _ ->
                    val i = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${ctx.packageName}")
                    ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                    ctx.startActivity(i)
                }
            ),
            Step(
                icon = Icons.Default.Mic,
                titleRes = R.string.perm_audio,
                bodyRes  = R.string.perm_audio_body,
                isGranted = { it.hasPermission(Manifest.permission.RECORD_AUDIO) },
                request = { _, _ -> audioLauncher.launch(Manifest.permission.RECORD_AUDIO) }
            ),
            Step(
                icon = Icons.Default.Notifications,
                titleRes = R.string.perm_notifications,
                bodyRes  = R.string.perm_notifications_body,
                isGranted = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        it.hasPermission(Manifest.permission.POST_NOTIFICATIONS)
                    } else true
                },
                request = { _, _ ->
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }
            ),
            Step(
                icon = Icons.Default.BatteryFull,
                titleRes = R.string.perm_battery,
                bodyRes  = R.string.perm_battery_body,
                isGranted = { it.isIgnoringBatteryOptimization() },
                request = { ctx, _ ->
                    val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${ctx.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    runCatching { ctx.startActivity(i) }
                },
                optional = true
            )
        )
    }

    val current = steps[index]
    val isGranted = current.isGranted(context)

    Box(
        Modifier
            .fillMaxSize()
            .background(NexosBackground)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth()
        ) {
            HaloIcon(current.icon)
            Spacer(Modifier.height(24.dp))
            AnimatedContent(
                targetState = index,
                label = "step",
                transitionSpec = {
                    val dir = if (targetState > initialState)
                        AnimatedContentTransitionScope.SlideDirection.Left
                    else
                        AnimatedContentTransitionScope.SlideDirection.Right
                    (slideIntoContainer(dir, tween(320)) + fadeIn(tween(220))) togetherWith
                        (slideOutOfContainer(dir, tween(280)) + fadeOut(tween(180)))
                }
            ) { i ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text  = stringResource(steps[i].titleRes),
                        style = MaterialTheme.typography.headlineMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text  = stringResource(steps[i].bodyRes),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
            Spacer(Modifier.height(36.dp))
            ProgressDots(count = steps.size, selected = index)
            Spacer(Modifier.height(28.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                if (current.optional || index == 0) {
                    OutlinedButton(
                        onClick = {
                            if (index < steps.lastIndex) index++ else onFinished()
                        },
                        modifier = Modifier.weight(1f)
                    ) { Text(if (index == 0) stringResource(R.string.action_continue) else stringResource(R.string.action_skip)) }
                }
                Button(
                    onClick = {
                        if (index == 0) {
                            index = 1
                        } else if (isGranted) {
                            if (index < steps.lastIndex) index++ else onFinished()
                        } else {
                            current.request(context, null)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NexosPrimary, contentColor = NexosBackground),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        when {
                            index == 0      -> stringResource(R.string.action_continue)
                            isGranted       -> stringResource(R.string.action_continue)
                            else            -> stringResource(R.string.action_grant)
                        }
                    )
                }
            }
            // Auto-advance once a granted state is detected.
            LaunchedEffect(isGranted, index) {
                if (index in 1..steps.lastIndex && isGranted && !current.optional) {
                    kotlinx.coroutines.delay(420)
                    if (index < steps.lastIndex) index++ else onFinished()
                }
            }
        }
    }
}

@Composable
private fun HaloIcon(icon: ImageVector) {
    val anim = remember { androidx.compose.animation.core.Animatable(0f) }
    LaunchedEffect(Unit) {
        anim.animateTo(
            1f,
            animationSpec = androidx.compose.animation.core.infiniteRepeatable(
                animation = tween(2800, easing = NexosMotion.EaseInOut),
                repeatMode = androidx.compose.animation.core.RepeatMode.Reverse
            )
        )
    }
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(160.dp)) {
        Box(
            modifier = Modifier
                .size(160.dp)
                .graphicsLayer {
                    val t = anim.value
                    val s = 0.85f + 0.2f * (0.5f + 0.5f * sin(t * 2 * Math.PI.toFloat()))
                    scaleX = s; scaleY = s
                    alpha = 0.55f
                }
                .background(
                    brush = Brush.radialGradient(listOf(NexosPrimaryGlow, Color.Transparent)),
                    shape = CircleShape
                )
        )
        Box(
            modifier = Modifier
                .size(96.dp)
                .background(
                    brush = Brush.linearGradient(listOf(NexosPrimary, NexosPrimaryGlow)),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = NexosBackground, modifier = Modifier.size(44.dp))
        }
    }
}

@Composable
private fun ProgressDots(count: Int, selected: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(count) { i ->
            val active = i == selected
            Box(
                modifier = Modifier
                    .height(6.dp)
                    .width(if (active) 22.dp else 6.dp)
                    .background(
                        color = if (active) NexosPrimary else MaterialTheme.colorScheme.outline,
                        shape = RoundedCornerShape(50)
                    )
            )
        }
    }
}
