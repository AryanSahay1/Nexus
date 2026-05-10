package com.nexus.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.nexus.app.ui.NexusApp
import com.nexus.app.ui.theme.NexusTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Restore app theme from splash overlay before composing.
        setTheme(R.style.Theme_Nexus)
        enableEdgeToEdge()
        setContent {
            NexusTheme {
                NexusApp()
            }
        }
    }
}
