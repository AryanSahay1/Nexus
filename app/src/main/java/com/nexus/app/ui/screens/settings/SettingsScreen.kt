package com.nexus.app.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.BuildConfig
import com.nexus.app.R
import com.nexus.app.ui.components.leather.LeatherCard
import com.nexus.app.ui.components.leather.LeatherCardVariant
import com.nexus.app.ui.components.leather.OutlineLeatherButton
import com.nexus.app.ui.theme.leather.LeatherPalette

@Composable
fun SettingsScreen(viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.settings_title),
                        color = LeatherPalette.PandaIvory
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            LeatherCard(
                modifier = Modifier.fillMaxWidth(),
                variant = LeatherCardVariant.Highlight,
                elevationLevel = 2,
                grainSeed = 33
            ) {
                Column {
                    Text(
                        text = "Nexus v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                        style = MaterialTheme.typography.titleMedium,
                        color = LeatherPalette.PandaIvory
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "All data lives on this device, encrypted by the Android Keystore.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LeatherPalette.PandaCream
                    )
                }
            }

            OutlineLeatherButton(
                text = stringResource(R.string.settings_factory_reset),
                onClick = viewModel::requestReset
            )

            if (state.showResetConfirm) {
                AlertDialog(
                    onDismissRequest = viewModel::cancelReset,
                    title = { Text(stringResource(R.string.settings_factory_reset)) },
                    text = { Text(stringResource(R.string.settings_factory_reset_confirm)) },
                    confirmButton = {
                        TextButton(onClick = viewModel::confirmReset) {
                            Text(
                                stringResource(R.string.common_yes),
                                color = LeatherPalette.ErrorOxblood
                            )
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = viewModel::cancelReset) {
                            Text(
                                stringResource(R.string.common_no),
                                color = LeatherPalette.PandaIvory
                            )
                        }
                    },
                    containerColor = LeatherPalette.Tobacco,
                    titleContentColor = LeatherPalette.PandaIvory,
                    textContentColor = LeatherPalette.PandaCream
                )
            }
        }
    }
}
