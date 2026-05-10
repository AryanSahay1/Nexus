package com.nexus.app.ui.screens.tabs

import androidx.compose.animation.Crossfade
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Memory
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nexus.app.R
import com.nexus.app.ui.components.leather.StitchedDivider
import com.nexus.app.ui.navigation.NexusDestinations
import com.nexus.app.ui.screens.chat.ChatScreen
import com.nexus.app.ui.screens.learn.LearnScreen
import com.nexus.app.ui.screens.memory.MemoryScreen
import com.nexus.app.ui.screens.settings.SettingsScreen
import com.nexus.app.ui.screens.vault.VaultScreen
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.LeatherTone
import com.nexus.app.ui.theme.leather.leatherSurface

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
    var selectedRoute by rememberSaveable { mutableStateOf(NexusDestinations.Tabs.LEARN) }
    Scaffold(
        containerColor = Color.Transparent,
        modifier = Modifier.leatherSurface(LeatherTone.Walnut),
        bottomBar = {
            LeatherBottomNav(
                selectedRoute = selectedRoute,
                onSelect = { selectedRoute = it }
            )
        }
    ) { padding ->
        // Crossfade the content area when the user changes tabs — keeps the
        // leather frame static while only the journal page turns.
        Crossfade(
            targetState = selectedRoute,
            animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Moderate),
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            label = "tabContent"
        ) { route ->
            when (route) {
                NexusDestinations.Tabs.LEARN -> LearnScreen()
                NexusDestinations.Tabs.CHAT -> ChatScreen()
                NexusDestinations.Tabs.VAULT -> VaultScreen()
                NexusDestinations.Tabs.MEMORY -> MemoryScreen()
                NexusDestinations.Tabs.SETTINGS -> SettingsScreen()
            }
        }
    }
}

@Composable
private fun LeatherBottomNav(
    selectedRoute: String,
    onSelect: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        // Top-edge thread divider so the nav reads as a separate piece of
        // leather sewn onto the page.
        StitchedDivider(thread = LeatherPalette.ThreadMoss.copy(alpha = 0.6f))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .leatherSurface(LeatherTone.Tobacco, grainSeed = 99)
                .padding(vertical = 8.dp, horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            tabs.forEach { tab ->
                NavTab(
                    item = tab,
                    selected = tab.route == selectedRoute,
                    onClick = { onSelect(tab.route) }
                )
            }
        }
    }
}

@Composable
private fun NavTab(
    item: TabItem,
    selected: Boolean,
    onClick: () -> Unit
) {
    val tint by animateColorAsState(
        targetValue = if (selected) LeatherPalette.ThreadFresh else LeatherPalette.PandaCream.copy(alpha = 0.65f),
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
        label = "navTabTint"
    )
    val pillAlpha by animateFloatAsState(
        targetValue = if (selected) 1f else 0f,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Fast),
        label = "navTabPillAlpha"
    )
    val pillScale by animateFloatAsState(
        targetValue = if (selected) 1f else 0.85f,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Normal),
        label = "navTabPillScale"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .clickable(role = Role.Tab, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 6.dp)
            .semantics { role = Role.Tab }
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(40.dp)
        ) {
            // Soft moss-green pill behind the selected icon. Animates in
            // and out instead of disappearing — the indicator feels weighted.
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .scale(pillScale)
                    .clip(RoundedCornerShape(14.dp))
                    .background(LeatherPalette.ThreadMoss.copy(alpha = 0.30f * pillAlpha))
            )
            Icon(
                imageVector = item.icon,
                contentDescription = null,
                tint = tint
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(
            text = stringResource(item.labelRes),
            style = MaterialTheme.typography.labelMedium,
            color = tint
        )
    }
}
