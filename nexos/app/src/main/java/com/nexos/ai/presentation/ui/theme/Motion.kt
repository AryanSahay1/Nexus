package com.nexos.ai.presentation.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Immutable

/**
 * NexOS motion design tokens — single source of truth for every animation.
 *
 * Rule: only ever animate transform & opacity (offset, scale, rotation, alpha).
 * Durations stay between 80–700ms per the UX-in-Motion guideline.
 */
@Immutable
object NexosMotion {

    // --- DURATIONS (milliseconds) ---
    const val DurationInstant     = 0
    const val DurationFast        = 100   // hover bg, color
    const val DurationNormal      = 150   // icon swap, fade
    const val DurationModerate    = 220   // dropdown, tooltip
    const val DurationSlow        = 320   // modal entry
    const val DurationDeliberate  = 480   // page transition
    const val DurationExpressive  = 640   // hero animation

    // --- EASINGS ---
    val EaseIn:      Easing = CubicBezierEasing(0.4f, 0.0f, 1.0f, 1.0f)
    val EaseOut:     Easing = CubicBezierEasing(0.0f, 0.0f, 0.2f, 1.0f)
    val EaseInOut:   Easing = CubicBezierEasing(0.4f, 0.0f, 0.2f, 1.0f)
    val EaseSpring:  Easing = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1.0f)
    val EaseBounce:  Easing = CubicBezierEasing(0.68f, -0.55f, 0.27f, 1.55f)
    val EaseEmphasized: Easing = CubicBezierEasing(0.2f, 0.0f, 0.0f, 1.0f)

    // --- TWEEN SPECS ---
    fun <T> fast()       = tween<T>(DurationFast,        easing = EaseOut)
    fun <T> normal()     = tween<T>(DurationNormal,      easing = EaseOut)
    fun <T> moderate()   = tween<T>(DurationModerate,    easing = EaseOut)
    fun <T> slow()       = tween<T>(DurationSlow,        easing = EaseEmphasized)
    fun <T> deliberate() = tween<T>(DurationDeliberate,  easing = EaseEmphasized)
    fun <T> enter()      = tween<T>(DurationSlow,        easing = EaseOut)
    fun <T> exit()       = tween<T>(DurationModerate,    easing = EaseIn)

    // --- SPRINGS ---
    fun <T> bouncy() = spring<T>(
        dampingRatio = Spring.DampingRatioMediumBouncy,
        stiffness    = Spring.StiffnessMediumLow
    )
    fun <T> snappy() = spring<T>(
        dampingRatio = Spring.DampingRatioNoBouncy,
        stiffness    = Spring.StiffnessMedium
    )
    fun <T> gentle() = spring<T>(
        dampingRatio = Spring.DampingRatioLowBouncy,
        stiffness    = Spring.StiffnessLow
    )

    // --- STAGGER ---
    const val StaggerStep = 60  // ms between staggered list-item enters
}
