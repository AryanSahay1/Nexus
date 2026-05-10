package com.nexos.ai.data.secure

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * EncryptedSharedPreferences wrapper for AI provider API keys.
 *
 * NEVER store API keys in plain SharedPreferences, DataStore, or BuildConfig.
 */
@Singleton
class SecureStorage @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val prefs: SharedPreferences by lazy { create() }

    private fun create(): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            PREF_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun saveApiKey(provider: String, key: String) {
        prefs.edit().putString(keyOf(provider), key).apply()
    }

    fun getApiKey(provider: String): String? = prefs.getString(keyOf(provider), null)

    fun clearApiKey(provider: String) {
        prefs.edit().remove(keyOf(provider)).apply()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    private fun keyOf(provider: String) = "api_key_$provider"

    companion object {
        private const val PREF_FILE = "nexos_secure"
    }
}
