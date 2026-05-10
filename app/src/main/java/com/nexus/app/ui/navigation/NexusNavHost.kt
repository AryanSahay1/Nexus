package com.nexus.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.nexus.app.ui.screens.onboarding.OnboardingScreen
import com.nexus.app.ui.screens.tabs.TabsRoot

@Composable
fun NexusNavHost(
    navController: NavHostController,
    startDestination: String
) {
    NavHost(navController = navController, startDestination = startDestination) {
        composable(NexusDestinations.ONBOARDING) {
            OnboardingScreen(
                onContinue = {
                    navController.navigate(NexusDestinations.TABS) {
                        popUpTo(NexusDestinations.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }
        composable(NexusDestinations.TABS) {
            TabsRoot()
        }
    }
}
