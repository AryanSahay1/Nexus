package com.nexus.app.data.secure

import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class TokenStoreTest {

    private lateinit var store: TokenStore

    @Before
    fun setup() {
        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        // Use plain SharedPreferences in unit tests — Robolectric does not
        // expose the real AndroidKeyStore, so EncryptedSharedPreferences is
        // exercised separately via instrumented tests.
        val prefs = ctx.getSharedPreferences("nexus_secure_test", android.content.Context.MODE_PRIVATE)
        store = TokenStore(prefs)
        store.wipe()
    }

    @Test
    fun `set and get round-trip an OpenAI key`() {
        val key = "sk-test-abcd1234"
        store.set(Provider.OpenAI, TokenType.ApiKey, key)
        assertThat(store.get(Provider.OpenAI, TokenType.ApiKey).getOrNull()).isEqualTo(key)
    }

    @Test
    fun `delete removes the key`() {
        store.set(Provider.OpenAI, TokenType.ApiKey, "sk-x")
        store.delete(Provider.OpenAI, TokenType.ApiKey)
        assertThat(store.get(Provider.OpenAI, TokenType.ApiKey).getOrNull()).isNull()
    }

    @Test
    fun `setOAuthBundle persists every individual field`() {
        val bundle = OAuthBundle(
            accessToken = "ya29.access",
            refreshToken = "1//refresh",
            idToken = "id.token",
            userEmail = "user@example.com",
            expiresAtEpochMs = 1_700_000_000_000L
        )
        store.setOAuthBundle(Provider.Google, bundle)

        assertThat(store.get(Provider.Google, TokenType.AccessToken).getOrNull()).isEqualTo("ya29.access")
        assertThat(store.get(Provider.Google, TokenType.RefreshToken).getOrNull()).isEqualTo("1//refresh")
        assertThat(store.get(Provider.Google, TokenType.IdToken).getOrNull()).isEqualTo("id.token")
        assertThat(store.get(Provider.Google, TokenType.UserEmail).getOrNull()).isEqualTo("user@example.com")
    }

    @Test
    fun `setOAuthBundle clears refreshToken when null in new bundle`() {
        store.setOAuthBundle(
            Provider.Google,
            OAuthBundle("a", "r", "i", "u", null)
        )
        store.setOAuthBundle(
            Provider.Google,
            OAuthBundle("a2", null, null, "u2", null)
        )
        assertThat(store.get(Provider.Google, TokenType.AccessToken).getOrNull()).isEqualTo("a2")
        assertThat(store.get(Provider.Google, TokenType.RefreshToken).getOrNull()).isNull()
        assertThat(store.get(Provider.Google, TokenType.IdToken).getOrNull()).isNull()
    }

    @Test
    fun `deleteAll clears every key for one provider but leaves another untouched`() {
        store.set(Provider.OpenAI, TokenType.ApiKey, "sk-keep")
        store.setOAuthBundle(Provider.Google, OAuthBundle("a", "r", null, "u", null))
        store.deleteAll(Provider.Google)

        assertThat(store.get(Provider.OpenAI, TokenType.ApiKey).getOrNull()).isEqualTo("sk-keep")
        assertThat(store.get(Provider.Google, TokenType.AccessToken).getOrNull()).isNull()
        assertThat(store.get(Provider.Google, TokenType.RefreshToken).getOrNull()).isNull()
    }

    @Test
    fun `connectedProviders detects both ApiKey and AccessToken`() {
        store.set(Provider.OpenAI, TokenType.ApiKey, "sk-1")
        store.setOAuthBundle(Provider.Google, OAuthBundle("a", null, null, null, null))
        val connected = store.connectedProviders().getOrNull()!!
        assertThat(connected).containsExactly(Provider.OpenAI, Provider.Google)
    }

    @Test
    fun `wipe removes every key`() {
        store.set(Provider.OpenAI, TokenType.ApiKey, "sk-1")
        store.setOAuthBundle(Provider.Google, OAuthBundle("a", null, null, null, null))
        store.wipe()
        val connected = store.connectedProviders().getOrNull()!!
        assertThat(connected).isEmpty()
    }
}
