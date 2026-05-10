package com.nexos.ai.presentation.ui

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nexos.ai.presentation.ui.components.AuroraBackground
import com.nexos.ai.presentation.ui.screens.detail.NoteDetailScreen
import com.nexos.ai.presentation.ui.screens.notes.NoteListScreen
import com.nexos.ai.presentation.ui.screens.settings.SettingsScreen
import com.nexos.ai.presentation.ui.theme.NexosMotion
import com.nexos.ai.presentation.viewmodel.NotesViewModel

object Routes {
    const val NOTE_LIST = "notes"
    const val NOTE_DETAIL = "notes/{id}"
    const val SETTINGS = "settings"
    fun noteDetail(id: Long) = "notes/$id"
}

@Composable
fun NexosApp(
    notesViewModel: NotesViewModel,
    onRequestProjection: () -> Unit,
    onToggleFloating: () -> Unit,
    autoOpenVoice: Boolean,
    onVoiceConsumed: () -> Unit,
) {
    val navController = rememberNavController()

    Box(modifier = Modifier.fillMaxSize()) {
        AuroraBackground()

        NavHost(
            navController = navController,
            startDestination = Routes.NOTE_LIST,
            enterTransition = {
                fadeIn(tween(NexosMotion.Slow, easing = NexosMotion.EaseEnter)) +
                    slideIntoContainer(
                        AnimatedContentTransitionScope.SlideDirection.Left,
                        tween(NexosMotion.Slow, easing = NexosMotion.EaseEnter),
                    )
            },
            exitTransition = {
                fadeOut(tween(NexosMotion.Normal)) +
                    slideOutOfContainer(
                        AnimatedContentTransitionScope.SlideDirection.Left,
                        tween(NexosMotion.Normal),
                    )
            },
            popEnterTransition = {
                fadeIn(tween(NexosMotion.Slow)) +
                    slideIntoContainer(
                        AnimatedContentTransitionScope.SlideDirection.Right,
                        tween(NexosMotion.Slow, easing = NexosMotion.EaseEnter),
                    )
            },
            popExitTransition = {
                fadeOut(tween(NexosMotion.Normal)) +
                    slideOutOfContainer(
                        AnimatedContentTransitionScope.SlideDirection.Right,
                        tween(NexosMotion.Normal),
                    )
            },
        ) {
            composable(Routes.NOTE_LIST) {
                NoteListScreen(
                    viewModel = notesViewModel,
                    onNoteClick = { id -> navController.navigate(Routes.noteDetail(id)) },
                    onSettingsClick = { navController.navigate(Routes.SETTINGS) },
                    onCaptureClick = onRequestProjection,
                    onToggleFloating = onToggleFloating,
                    autoOpenVoice = autoOpenVoice,
                    onVoiceConsumed = onVoiceConsumed,
                )
            }
            composable(
                route = Routes.NOTE_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.LongType }),
            ) {
                NoteDetailScreen(onBack = { navController.popBackStack() })
            }
            composable(Routes.SETTINGS) {
                SettingsScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
