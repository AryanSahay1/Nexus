package com.nexus.app.ui.screens.tabs

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Memory
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nexus.app.R
import com.nexus.app.ui.navigation.NexusDestinations
import com.nexus.app.ui.screens.chat.ChatScreen
import com.nexus.app.ui.screens.learn.LearnScreen
import com.nexus.app.ui.screens.memory.MemoryScreen
import com.nexus.app.ui.screens.settings.SettingsScreen
import com.nexus.app.ui.screens.vault.VaultScreen

private data class TabItem(
    val route: String,
    val labelRes: Int,
    val icon: ImageVector
)

private val tabs = listOf(
    TabItem(NexusDestinations.Tabs.LEARN, R.string.tab_learn, Icons.Outlined.School),
    TabItem(NexusDestinations.Tabs.CHAT, R.string.tab_chat, Icons.AutoMirrored.Outlined.Chat),
    TabItem(NexusDestinations.Tabs.VAULT, R.string.tab_vault, Icons.Outlined.Lock),
    TabItem(NexusDestinations.Tabs.MEMORY, R.string.tab_memory, Icons.Outlined.Memory),
    TabItem(NexusDestinations.Tabs.SETTINGS, R.string.tab_settings, Icons.Outlined.Settings)
)

@Composable
fun TabsRoot() {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface
            ) {
                tabs.forEach { tab ->
                    val selected = backStack?.destination?.hierarchy?.any { it.route == tab.route } == true ||
                        currentRoute == tab.route
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = { Text(stringResource(tab.labelRes)) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = MaterialTheme.colorScheme.surfaceVariant,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = NexusDestinations.Tabs.LEARN,
            modifier = Modifier.padding(padding)
        ) {
            composable(NexusDestinations.Tabs.LEARN) { LearnScreen() }
            composable(NexusDestinations.Tabs.CHAT) { ChatScreen() }
            composable(NexusDestinations.Tabs.VAULT) { VaultScreen() }
            composable(NexusDestinations.Tabs.MEMORY) { MemoryScreen() }
            composable(NexusDestinations.Tabs.SETTINGS) { SettingsScreen() }
        }
    }
}
