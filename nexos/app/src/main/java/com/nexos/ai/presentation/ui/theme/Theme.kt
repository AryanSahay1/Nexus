package com.nexos.ai.presentation.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val NexosDarkColors = darkColorScheme(
    primary = NexosPrimary,
    onPrimary = NexosOnPrimary,
    secondary = NexosInfo,
    onSecondary = Color.White,
    tertiary = NexosAurora3,
    background = NexosBackground,
    onBackground = NexosOnSurface,
    surface = NexosSurface,
    onSurface = NexosOnSurface,
    surfaceVariant = NexosSurfaceElevated,
    onSurfaceVariant = NexosOnSurfaceMuted,
    outline = NexosOutline,
    outlineVariant = NexosOutlineStrong,
    error = NexosError,
    onError = Color.White,
)

// NexOS is dark-first per the spec; light scheme is provided as a fallback only.
private val NexosLightColors = lightColorScheme(
    primary = NexosPrimary,
    onPrimary = NexosOnPrimary,
    secondary = NexosInfo,
    background = Color(0xFFFAFAFC),
    surface = Color.White,
    onBackground = Color(0xFF111111),
    onSurface = Color(0xFF111111),
)

@Composable
fun NexosTheme(
    darkTheme: Boolean = true, // dark default per product spec
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) NexosDarkColors else NexosLightColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = NexosTypography,
        content = content,
    )
}
