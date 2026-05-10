package com.nexos.ai.presentation.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.tween

/**
 * Motion design tokens for NexOS.
 *
 * Aligned with the UI/UX motion master skill (§9):
 * - Animate only `transform` and `opacity` equivalents (alpha + translation/scale)
 * - Durations capped at 700ms; UI sits in the 80–400ms band
 * - Easing curves chosen per use-case (enter, exit, spring, bounce)
 */
object NexosMotion {

    // -- Durations (ms) --
    const val Instant = 0
    const val Fast = 80           // hover/highlight, color swaps
    const val Normal = 150        // icon swap, subtle fade
    const val Moderate = 250      // dropdown / tooltip
    const val Slow = 350          // modal entry, list reveal
    const val Deliberate = 500    // page transitions
    const val Expressive = 700    // hero, onboarding flourish

    // -- Easing --
    val EaseIn: Easing = CubicBezierEasing(0.4f, 0f, 1f, 1f)
    val EaseOut: Easing = CubicBezierEasing(0f, 0f, 0.2f, 1f)
    val EaseInOut: Easing = CubicBezierEasing(0.4f, 0f, 0.2f, 1f)
    val EaseSpring: Easing = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)
    val EaseBounce: Easing = CubicBezierEasing(0.68f, -0.55f, 0.27f, 1.55f)
    val EaseEnter: Easing = EaseOut
    val EaseExit: Easing = EaseIn

    // -- Stagger delays for list reveals --
    const val StaggerStep = 60    // 60ms per nth-child

    // -- Convenience tween factories --
    fun <T> tweenEnter(durationMillis: Int = Slow) =
        tween<T>(durationMillis = durationMillis, easing = EaseEnter)

    fun <T> tweenExit(durationMillis: Int = Normal) =
        tween<T>(durationMillis = durationMillis, easing = EaseExit)

    fun <T> tweenSpringy(durationMillis: Int = Slow) =
        tween<T>(durationMillis = durationMillis, easing = EaseSpring)
}
