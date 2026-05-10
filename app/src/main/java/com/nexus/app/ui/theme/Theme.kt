package com.nexus.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val NexusDarkColors = darkColorScheme(
    primary = BrandPrimary,
    onPrimary = Color.White,
    primaryContainer = BrandPrimaryDim,
    onPrimaryContainer = Color.White,
    secondary = BrandSecondary,
    onSecondary = Color.Black,
    tertiary = BrandAccent,
    background = BackgroundDark,
    onBackground = OnSurfaceDark,
    surface = SurfaceDark,
    onSurface = OnSurfaceDark,
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = OnSurfaceMutedDark,
    outline = OutlineDark,
    error = ErrorRed,
    onError = Color.White
)

private val NexusLightColors = lightColorScheme(
    primary = BrandPrimary,
    onPrimary = Color.White,
    secondary = BrandSecondary,
    background = Color(0xFFF8F8FB),
    onBackground = Color(0xFF15151F),
    surface = Color.White,
    onSurface = Color(0xFF15151F),
    error = ErrorRed
)

@Composable
fun NexusTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) NexusDarkColors else NexusLightColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colors.background.toArgb()
            window.navigationBarColor = colors.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colors,
        typography = NexusTypography,
        content = content
    )
}
