package com.nexos.ai.presentation.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// We rely on the system sans-serif so the APK stays small and ships without
// font assets. The 'monospace' variant doubles as the AI / code voice.
val NexosFontFamily: FontFamily = FontFamily.SansSerif
val NexosMonoFamily: FontFamily = FontFamily.Monospace

val NexosTypography: Typography = Typography(
    displayLarge = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Bold,
        fontSize = 40.sp, lineHeight = 44.sp, letterSpacing = (-0.5).sp
    ),
    displayMedium = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Bold,
        fontSize = 32.sp, lineHeight = 36.sp, letterSpacing = (-0.5).sp
    ),
    displaySmall = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.SemiBold,
        fontSize = 26.sp, lineHeight = 32.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp, lineHeight = 28.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp, lineHeight = 24.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp, lineHeight = 24.sp
    ),
    titleLarge = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Medium,
        fontSize = 18.sp, lineHeight = 22.sp
    ),
    titleMedium = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Medium,
        fontSize = 16.sp, lineHeight = 20.sp
    ),
    titleSmall = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Medium,
        fontSize = 14.sp, lineHeight = 18.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Normal,
        fontSize = 16.sp, lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Normal,
        fontSize = 14.sp, lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Normal,
        fontSize = 12.sp, lineHeight = 16.sp
    ),
    labelLarge = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp, lineHeight = 18.sp, letterSpacing = 0.4.sp
    ),
    labelMedium = TextStyle(
        fontFamily = NexosFontFamily, fontWeight = FontWeight.Medium,
        fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily = NexosMonoFamily, fontWeight = FontWeight.Medium,
        fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.8.sp
    )
)
