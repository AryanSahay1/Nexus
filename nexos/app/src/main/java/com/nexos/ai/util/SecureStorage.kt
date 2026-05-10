package com.nexos.ai.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Single source of truth for sensitive on-device values (API keys).
 * Backed by Jetpack Security's AES256-GCM encrypted prefs.
 */
object SecureStorage {

    private const val TAG       = "NexOS/SecureStorage"
    private const val PREF_FILE = "nexos_secure"
    private const val KEY_PREFIX = "api_key_"

    private fun open(context: Context): SharedPreferences = try {
        val master = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context.applicationContext,
            PREF_FILE,
            master,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        Log.e(TAG, "Failed to open EncryptedSharedPreferences; falling back to plaintext.", e)
        context.applicationContext.getSharedPreferences("${PREF_FILE}_fallback", Context.MODE_PRIVATE)
    }

    fun getApiKey(context: Context, provider: String): String? =
        open(context).getString(KEY_PREFIX + provider, null)?.takeIf { it.isNotBlank() }

    fun saveApiKey(context: Context, provider: String, key: String) {
        open(context).edit().putString(KEY_PREFIX + provider, key.trim()).apply()
    }

    fun clearApiKey(context: Context, provider: String) {
        open(context).edit().remove(KEY_PREFIX + provider).apply()
    }

    fun hasAnyKey(context: Context): Boolean =
        open(context).all.keys.any { it.startsWith(KEY_PREFIX) }
}
