package com.nexos.ai.presentation.ui.theme

import android.app.Activity
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val NexosDarkColors = darkColorScheme(
    primary             = NexosPrimary,
    onPrimary           = NexosBackground,
    primaryContainer    = NexosPrimaryDim,
    onPrimaryContainer  = NexosBackground,

    secondary           = NexosPrimaryGlow,
    onSecondary         = NexosBackground,
    secondaryContainer  = NexosSurfaceHigh,
    onSecondaryContainer= NexosOnSurface,

    tertiary            = NexosInfo,
    onTertiary          = NexosBackground,
    tertiaryContainer   = NexosSurfaceHigh,
    onTertiaryContainer = NexosOnSurface,

    background          = NexosBackground,
    onBackground        = NexosOnSurface,

    surface             = NexosSurface,
    onSurface           = NexosOnSurface,
    surfaceVariant      = NexosSurfaceMuted,
    onSurfaceVariant    = NexosOnSurfaceDim,

    outline             = NexosOutline,
    outlineVariant      = NexosOutline,

    error               = NexosError,
    onError             = NexosBackground
)

private val NexosShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small      = RoundedCornerShape(10.dp),
    medium     = RoundedCornerShape(14.dp),
    large      = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp)
)

@Composable
fun NexosTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor     = NexosBackground.toArgb()
            window.navigationBarColor = NexosBackground.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars     = false
                isAppearanceLightNavigationBars = false
            }
        }
    }
    MaterialTheme(
        colorScheme = NexosDarkColors,
        typography  = NexosTypography,
        shapes      = NexosShapes,
        content     = content
    )
}
