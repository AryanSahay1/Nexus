package com.nexus.app.ui.components.leather

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.reduceMotion
import kotlinx.coroutines.delay
import kotlin.math.min

/**
 * StaggeredEntry — wrap any composable in an indexed fade-up entrance.
 *
 * Implements UI/UX skill §9 (motion design — staggered reveal) and §13
 * (scroll-driven design — entrance choreography). The first item of a
 * list lands at zero delay; each subsequent item is offset by `stepMs`,
 * capped at `maxDelayMs` so a 200-row list still finishes its enter
 * choreography before the user can read the bottom.
 *
 * Reduced-motion users see the children at their final state on first
 * paint — no offset, no fade, no missed frame.
 */
@Composable
fun StaggeredEntry(
    index: Int,
    modifier: Modifier = Modifier,
    stepMs: Int = 60,
    maxDelayMs: Int = 360,
    fromOffsetDp: Int = 12,
    durationMs: Int = LeatherMotion.Normal,
    content: @Composable () -> Unit
) {
    val reduce = reduceMotion()
    val target = remember(index) {
        MutableTransitionState(initialState = reduce).apply {
            // When reduce-motion is on, the visible state is `true` from
            // first composition so AnimatedVisibility skips the enter
            // animation entirely.
        }
    }
    val delayMs = min(index * stepMs, maxDelayMs)

    LaunchedEffect(index, reduce) {
        if (!reduce) {
            delay(delayMs.toLong())
            target.targetState = true
        } else {
            target.targetState = true
        }
    }

    AnimatedVisibility(
        visibleState = target,
        modifier = modifier,
        enter = fadeIn(
            animationSpec = tween(durationMs, easing = LeatherMotion.EaseOutLeather)
        ) + slideInVertically(
            animationSpec = tween(durationMs, easing = LeatherMotion.EaseOutLeather),
            // 1/8th of the row's intrinsic height — subtle, not melodramatic.
            // The skill file's §9 calls out 8–16 dp travel as the sweet spot
            // for list entrances.
            initialOffsetY = { full -> (full / 8).coerceAtLeast(fromOffsetDp) }
        )
    ) {
        content()
    }
}
