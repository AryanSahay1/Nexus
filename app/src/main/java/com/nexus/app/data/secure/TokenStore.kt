package com.nexus.app.data.secure

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.nexus.app.core.NexusError
import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.core.runCatchingNexus
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Encrypted token store backed by Android Keystore (AES-256-GCM via
 * AndroidX Security `EncryptedSharedPreferences`). This is the Android
 * equivalent of `expo-secure-store`.
 *
 * Storage key contract: `nexus_<provider>_<tokenType>` — only individual
 * token strings, never raw OAuth-response JSON blobs.
 */
@Singleton
class TokenStore @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val prefs: SharedPreferences by lazy { open() }

    private fun open(): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun get(provider: Provider, type: TokenType): NexusResult<String?> =
        runCatchingNexus(NexusErrorCode.SECURE_STORE_ERROR) { prefs.getString(key(provider, type), null) }

    fun set(provider: Provider, type: TokenType, value: String): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.SECURE_STORE_ERROR) {
            prefs.edit().putString(key(provider, type), value).apply()
        }

    fun delete(provider: Provider, type: TokenType): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.SECURE_STORE_ERROR) {
            prefs.edit().remove(key(provider, type)).apply()
        }

    /**
     * Atomic OAuth bundle write. Either every field is persisted or every
     * field is rolled back to its previous value (LAW 5).
     */
    fun setOAuthBundle(provider: Provider, bundle: OAuthBundle): NexusResult<Unit> {
        val snapshot: Map<TokenType, String?> = TokenType.entries.associateWith { type ->
            prefs.getString(key(provider, type), null)
        }
        return runCatchingNexus(NexusErrorCode.SECURE_STORE_ERROR) {
            val editor = prefs.edit()
            editor.putString(key(provider, TokenType.AccessToken), bundle.accessToken)
            bundle.refreshToken?.let { editor.putString(key(provider, TokenType.RefreshToken), it) }
                ?: editor.remove(key(provider, TokenType.RefreshToken))
            bundle.idToken?.let { editor.putString(key(provider, TokenType.IdToken), it) }
                ?: editor.remove(key(provider, TokenType.IdToken))
            bundle.userEmail?.let { editor.putString(key(provider, TokenType.UserEmail), it) }
                ?: editor.remove(key(provider, TokenType.UserEmail))
            bundle.expiresAtEpochMs?.let { editor.putString(key(provider, TokenType.TokenExpiry), it.toString()) }
                ?: editor.remove(key(provider, TokenType.TokenExpiry))
            if (!editor.commit()) {
                rollback(provider, snapshot)
                throw NexusError(
                    code = NexusErrorCode.SECURE_STORE_ERROR,
                    message = "Atomic OAuth bundle commit returned false",
                    isRetryable = true
                )
            }
        }
    }

    fun deleteAll(provider: Provider): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.SECURE_STORE_ERROR) {
            val editor = prefs.edit()
            for (t in TokenType.entries) editor.remove(key(provider, t))
            editor.apply()
        }

    fun wipe(): NexusResult<Unit> = runCatchingNexus(NexusErrorCode.SECURE_STORE_ERROR) {
        prefs.edit().clear().apply()
    }

    fun connectedProviders(): NexusResult<Set<Provider>> = runCatchingNexus(NexusErrorCode.SECURE_STORE_ERROR) {
        Provider.entries.filterTo(mutableSetOf()) { p ->
            val accessKey = key(p, TokenType.AccessToken)
            val apiKey = key(p, TokenType.ApiKey)
            prefs.contains(accessKey) || prefs.contains(apiKey)
        }
    }

    private fun rollback(provider: Provider, snapshot: Map<TokenType, String?>) {
        val editor = prefs.edit()
        snapshot.forEach { (type, prev) ->
            if (prev != null) editor.putString(key(provider, type), prev)
            else editor.remove(key(provider, type))
        }
        editor.apply()
    }

    private fun key(provider: Provider, type: TokenType): String =
        "nexus_${provider.id}_${type.id}"

    companion object {
        private const val FILE_NAME = "nexus_secure_v1"
    }
}

enum class Provider(val id: String) {
    OpenAI("openai"),
    Google("google");

    companion object {
        fun fromId(id: String): Provider? = entries.firstOrNull { it.id == id }
    }
}

enum class TokenType(val id: String) {
    ApiKey("apiKey"),
    AccessToken("accessToken"),
    RefreshToken("refreshToken"),
    IdToken("idToken"),
    TokenExpiry("tokenExpiry"),
    UserEmail("userEmail")
}

data class OAuthBundle(
    val accessToken: String,
    val refreshToken: String?,
    val idToken: String?,
    val userEmail: String?,
    val expiresAtEpochMs: Long?
)
