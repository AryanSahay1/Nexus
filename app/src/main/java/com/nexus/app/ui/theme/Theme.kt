package com.nexus.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.LocalReduceMotion
import com.nexus.app.ui.theme.leather.rememberReduceMotion

/**
 * Panda Leather theme — `LeatherPalette` mapped into Material 3 slots.
 *
 *  Material 3 slot              ↦ Panda Leather token
 *  ─────────────────────────────────────────────────────
 *  primary                      ↦ ThreadFresh (selected/CTA)
 *  primaryContainer             ↦ ThreadMoss
 *  secondary                    ↦ ThreadLime
 *  background                   ↦ Walnut (dark) / PandaIvory (light)
 *  surface                      ↦ Tobacco / PandaCream
 *  surfaceVariant               ↦ Saddle / Tan
 *  onPrimary                    ↦ PandaIvory
 *  onBackground / onSurface     ↦ PandaCream / PandaCharcoal
 *  outline                      ↦ ThreadMoss (the stitching colour)
 *  error                        ↦ ErrorOxblood
 */
private val NexusDarkColors = darkColorScheme(
    primary = LeatherPalette.ThreadFresh,
    onPrimary = LeatherPalette.PandaIvory,
    primaryContainer = LeatherPalette.ThreadMoss,
    onPrimaryContainer = LeatherPalette.PandaIvory,
    secondary = LeatherPalette.ThreadLime,
    onSecondary = LeatherPalette.PandaCharcoal,
    tertiary = LeatherPalette.WarningAmber,
    onTertiary = LeatherPalette.PandaCharcoal,
    background = LeatherPalette.Walnut,
    onBackground = LeatherPalette.PandaCream,
    surface = LeatherPalette.Tobacco,
    onSurface = LeatherPalette.PandaCream,
    surfaceVariant = LeatherPalette.Saddle,
    onSurfaceVariant = LeatherPalette.PandaIvory,
    outline = LeatherPalette.ThreadMoss,
    outlineVariant = LeatherPalette.ThreadMoss,
    error = LeatherPalette.ErrorOxblood,
    onError = LeatherPalette.PandaIvory,
    scrim = LeatherPalette.Deep
)

private val NexusLightColors = lightColorScheme(
    primary = LeatherPalette.ThreadMoss,
    onPrimary = LeatherPalette.PandaIvory,
    primaryContainer = LeatherPalette.ThreadFresh,
    onPrimaryContainer = LeatherPalette.PandaCharcoal,
    secondary = LeatherPalette.ThreadFresh,
    onSecondary = LeatherPalette.PandaIvory,
    tertiary = LeatherPalette.WarningAmber,
    onTertiary = LeatherPalette.PandaCharcoal,
    background = LeatherPalette.PandaIvory,
    onBackground = LeatherPalette.PandaCharcoal,
    surface = LeatherPalette.PandaCream,
    onSurface = LeatherPalette.PandaCharcoal,
    surfaceVariant = LeatherPalette.Tan,
    onSurfaceVariant = LeatherPalette.PandaSlate,
    outline = LeatherPalette.ThreadMoss,
    outlineVariant = LeatherPalette.ThreadMoss,
    error = LeatherPalette.ErrorOxblood,
    onError = LeatherPalette.PandaIvory,
    scrim = LeatherPalette.Deep
)

@Composable
fun NexusTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) NexusDarkColors else NexusLightColors
    val reduceMotion = rememberReduceMotion()

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Status / navigation bars match the leather background so the
            // whole canvas reads as one continuous piece of material.
            window.statusBarColor = colors.background.toArgb()
            window.navigationBarColor = colors.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalReduceMotion provides reduceMotion) {
        MaterialTheme(
            colorScheme = colors,
            typography = NexusTypography,
            content = content
        )
    }
}

@Suppress("unused") // kept so older imports keep resolving while we migrate
private fun colorAlias(c: Color): Color = c
