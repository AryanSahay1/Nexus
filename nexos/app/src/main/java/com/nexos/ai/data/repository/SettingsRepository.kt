package com.nexos.ai.data.repository

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.nexos.ai.domain.model.AiProviderKey
import com.nexos.ai.domain.model.FloatingButtonSide
import com.nexos.ai.domain.model.NexosSettings
import com.nexos.ai.util.SecureStorage
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.nexosDataStore by preferencesDataStore(name = "nexos_prefs")

@Singleton
class SettingsRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private object Keys {
        val PROVIDER             = stringPreferencesKey("ai_provider")
        val AUTO_SUMMARIZE       = booleanPreferencesKey("auto_summarize")
        val AUTO_SAVE            = booleanPreferencesKey("auto_save")
        val SHOW_FLOATING_BUTTON = booleanPreferencesKey("show_floating_button")
        val FLOATING_BUTTON_SIDE = stringPreferencesKey("floating_button_side")
    }

    val settings: Flow<NexosSettings> = context.nexosDataStore.data.map { prefs ->
        NexosSettings(
            provider           = AiProviderKey.from(prefs[Keys.PROVIDER]),
            autoSummarize      = prefs[Keys.AUTO_SUMMARIZE] ?: true,
            autoSave           = prefs[Keys.AUTO_SAVE] ?: true,
            showFloatingButton = prefs[Keys.SHOW_FLOATING_BUTTON] ?: true,
            floatingSide       = FloatingButtonSide.from(prefs[Keys.FLOATING_BUTTON_SIDE])
        )
    }

    suspend fun setProvider(provider: AiProviderKey) {
        context.nexosDataStore.edit { it[Keys.PROVIDER] = provider.key }
    }

    suspend fun setAutoSummarize(enabled: Boolean) {
        context.nexosDataStore.edit { it[Keys.AUTO_SUMMARIZE] = enabled }
    }

    suspend fun setAutoSave(enabled: Boolean) {
        context.nexosDataStore.edit { it[Keys.AUTO_SAVE] = enabled }
    }

    suspend fun setShowFloatingButton(enabled: Boolean) {
        context.nexosDataStore.edit { it[Keys.SHOW_FLOATING_BUTTON] = enabled }
    }

    suspend fun setFloatingSide(side: FloatingButtonSide) {
        context.nexosDataStore.edit { it[Keys.FLOATING_BUTTON_SIDE] = side.key }
    }

    /** Convenience getters/setters for sensitive values. */
    fun apiKeyFor(provider: AiProviderKey): String? =
        SecureStorage.getApiKey(context, provider.key)

    fun saveApiKey(provider: AiProviderKey, key: String) {
        SecureStorage.saveApiKey(context, provider.key, key)
    }

    fun clearApiKey(provider: AiProviderKey) {
        SecureStorage.clearApiKey(context, provider.key)
    }
}
