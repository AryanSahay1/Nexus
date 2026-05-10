package com.nexos.ai.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "nexos_settings"
)

@Singleton
class SettingsRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val AI_PROVIDER = stringPreferencesKey("ai_provider")
        val AUTO_SUMMARIZE = booleanPreferencesKey("auto_summarize")
        val AUTO_SAVE = booleanPreferencesKey("auto_save")
        val FLOATING_BUTTON_SIDE = stringPreferencesKey("button_side")
        val SHOW_FLOATING_BUTTON = booleanPreferencesKey("show_button")
    }

    val aiProvider: Flow<String> =
        context.dataStore.data.map { it[Keys.AI_PROVIDER] ?: "none" }

    val autoSummarize: Flow<Boolean> =
        context.dataStore.data.map { it[Keys.AUTO_SUMMARIZE] ?: true }

    val autoSave: Flow<Boolean> =
        context.dataStore.data.map { it[Keys.AUTO_SAVE] ?: true }

    val floatingButtonSide: Flow<String> =
        context.dataStore.data.map { it[Keys.FLOATING_BUTTON_SIDE] ?: "right" }

    val showFloatingButton: Flow<Boolean> =
        context.dataStore.data.map { it[Keys.SHOW_FLOATING_BUTTON] ?: false }

    suspend fun setAiProvider(value: String) {
        context.dataStore.edit { it[Keys.AI_PROVIDER] = value }
    }

    suspend fun setAutoSummarize(value: Boolean) {
        context.dataStore.edit { it[Keys.AUTO_SUMMARIZE] = value }
    }

    suspend fun setAutoSave(value: Boolean) {
        context.dataStore.edit { it[Keys.AUTO_SAVE] = value }
    }

    suspend fun setFloatingButtonSide(value: String) {
        context.dataStore.edit { it[Keys.FLOATING_BUTTON_SIDE] = value }
    }

    suspend fun setShowFloatingButton(value: Boolean) {
        context.dataStore.edit { it[Keys.SHOW_FLOATING_BUTTON] = value }
    }
}
