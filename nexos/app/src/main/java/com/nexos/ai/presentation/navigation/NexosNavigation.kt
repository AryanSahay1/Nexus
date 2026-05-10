package com.nexos.ai.presentation.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nexos.ai.presentation.ui.notes.NoteDetailScreen
import com.nexos.ai.presentation.ui.notes.NoteListScreen
import com.nexos.ai.presentation.ui.onboarding.OnboardingScreen
import com.nexos.ai.presentation.ui.settings.SettingsScreen

object NexosRoutes {
    const val ONBOARDING = "onboarding"
    const val NOTES      = "notes"
    const val DETAIL     = "notes/{noteId}"
    const val SETTINGS   = "settings"

    fun detail(noteId: Long) = "notes/$noteId"
}

@Composable
fun NexosNavGraph(
    startRoute: String,
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = startRoute,
        enterTransition  = {
            slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Start, tween(320)) +
                fadeIn(tween(220))
        },
        exitTransition   = { fadeOut(tween(150)) },
        popEnterTransition = { fadeIn(tween(220)) },
        popExitTransition  = {
            slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.End, tween(280)) +
                fadeOut(tween(150))
        }
    ) {
        composable(NexosRoutes.ONBOARDING) {
            OnboardingScreen(
                onFinished = {
                    navController.navigate(NexosRoutes.NOTES) {
                        popUpTo(NexosRoutes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }
        composable(NexosRoutes.NOTES) {
            NoteListScreen(
                onNoteClick     = { id -> navController.navigate(NexosRoutes.detail(id)) },
                onSettingsClick = { navController.navigate(NexosRoutes.SETTINGS) }
            )
        }
        composable(
            route = NexosRoutes.DETAIL,
            arguments = listOf(navArgument("noteId") { type = NavType.StringType })
        ) {
            NoteDetailScreen(onBack = { navController.popBackStack() })
        }
        composable(NexosRoutes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
