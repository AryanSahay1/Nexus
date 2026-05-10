package com.nexus.app.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.rememberNavController
import com.nexus.app.ui.components.LoadingScreen
import com.nexus.app.ui.navigation.NexusDestinations
import com.nexus.app.ui.navigation.NexusNavHost
import com.nexus.app.ui.navigation.RootViewModel

@Composable
fun NexusApp() {
    val viewModel: RootViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val navController = rememberNavController()
    Surface(modifier = Modifier.fillMaxSize()) {
        // B-6 fix: until the start destination is resolved (single fast read
        // from the Keystore-backed prefs), render a loading shell instead of
        // flashing the onboarding screen for users who already have a key.
        val destination = state.startDestination
        if (destination == null) {
            LoadingScreen()
        } else {
            NexusNavHost(navController = navController, startDestination = destination)
            // B-24 fix: when the saved key disappears (factory reset), pop the
            // back-stack and route to onboarding without requiring a relaunch.
            LaunchedEffect(destination) {
                if (destination == NexusDestinations.ONBOARDING) {
                    navController.popBackStack(NexusDestinations.TABS, inclusive = true)
                }
            }
        }
    }
}
