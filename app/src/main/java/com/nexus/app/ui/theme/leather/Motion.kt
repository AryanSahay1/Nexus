package com.nexus.app.ui.theme.leather

import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext

/**
 * Panda Leather motion system. See `docs/UI_DESIGN_PRD.md §7`.
 *
 * Compose-side mirror of the duration/easing scale defined in the PRD.
 * Every animation in the app reads its parameters from this file so the
 * timing remains globally tweakable without touching screen code.
 */
object LeatherMotion {

    // Durations (ms) — match the table in the PRD.
    const val Instant = 0
    const val Fast = 120
    const val Normal = 240
    const val Moderate = 360
    const val Slow = 500
    const val Expressive = 700

    // Easings — three Compose-friendly cubic-béziers.
    val EaseOutLeather = CubicBezierEasing(0f, 0f, 0.2f, 1f)
    val EaseInLeather = CubicBezierEasing(0.4f, 0f, 1f, 1f)
    val EaseSpring = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)

    /**
     * Tween that respects the user's reduce-motion preference. Reads the
     * `LocalReduceMotion` flag and collapses to a 0 ms tween so transitions
     * still happen — they're just instantaneous, not gone.
     */
    @Composable
    @ReadOnlyComposable
    fun <T> tweenLeather(
        durationMillis: Int = Normal,
        easing: androidx.compose.animation.core.Easing = EaseOutLeather
    ): androidx.compose.animation.core.TweenSpec<T> =
        if (LocalReduceMotion.current) tween(durationMillis = Instant)
        else tween(durationMillis = durationMillis, easing = easing)

    /**
     * Spring used for the confirmation card and other "weight" moments.
     * Damping ratio 0.7 + low stiffness lands the overshoot at ~480 ms.
     */
    @Composable
    @ReadOnlyComposable
    fun <T> springLeather(): SpringSpec<T> = if (LocalReduceMotion.current) {
        spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessHigh)
    } else {
        spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessLow)
    }
}

/**
 * `true` when the user has set Animator duration scale to 0 in
 * Developer Options or has otherwise asked the system to reduce motion.
 * `MainActivity` resolves the value from `Settings.Global` and supplies it
 * via this `CompositionLocal`.
 */
val LocalReduceMotion = staticCompositionLocalOf { false }

/**
 * Resolves the system-wide animator scale and returns true when motion
 * should be skipped. Called from `MainActivity` so the value can be
 * provided to the entire composition tree.
 */
fun resolveReduceMotion(context: android.content.Context): Boolean = runCatching {
    val scale = Settings.Global.getFloat(
        context.contentResolver,
        Settings.Global.ANIMATOR_DURATION_SCALE,
        1f
    )
    scale == 0f
}.getOrDefault(false)

/** Convenience composable to read the flag in screens. */
@Composable
@ReadOnlyComposable
fun reduceMotion(): Boolean = LocalReduceMotion.current

/**
 * Captured for parity with the JS-flavoured PRD; the Compose code reads
 * the value via `LocalContext.current` if it ever needs to recompute on
 * the fly (e.g. during a settings change).
 */
@Composable
fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return resolveReduceMotion(context)
}

/** Local for hosts that want to override (testing, previews). */
val LocalLeatherDebug = compositionLocalOf { false }
