package com.nexus.app.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.rememberNavController
import com.nexus.app.ui.navigation.NexusNavHost
import com.nexus.app.ui.navigation.RootViewModel

@Composable
fun NexusApp() {
    val viewModel: RootViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val navController = rememberNavController()
    Surface(modifier = Modifier.fillMaxSize()) {
        NexusNavHost(
            navController = navController,
            startDestination = state.startDestination
        )
    }
}
