/**
 * useAuth — single React-side surface for auth state.
 *
 * Wraps vaultStore (canonical connection-state snapshot) + authStore
 * (connect/disconnect actions) + tokenService (the connected user's
 * email if Google is connected) so screens never reach into the
 * underlying primitives directly. Per LAW 9: components never call
 * services; they go through hooks → services.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStore } from 'zustand';

import * as tokenService from '../services/tokenService';
import { getAuthStore } from '../store/authStore';
import {
  getVaultStore,
  hasAnyConnection,
  isOpenAiConfigured,
} from '../store/vaultStore';
import { type NexusError, type Provider, type Result } from '../types/auth';

export interface UseAuthApi {
  /** Whether any OAuth/API-key credential is currently stored. */
  readonly anyConnection: boolean;
  /** Whether the OpenAI/Groq API key is set. */
  readonly openAiConfigured: boolean;
  /** Whether Google is connected and has a stored access token. */
  readonly googleConnected: boolean;
  /** The connected Google account email (or null if not connected). */
  readonly googleEmail: string | null;
  readonly connecting: boolean;
  readonly disconnecting: boolean;
  readonly lastError: NexusError | null;
  /** Initiate the Google OAuth flow with the supplied client ID. */
  readonly connectGoogle: (
    clientId: string,
  ) => Promise<Result<{ email: string | null }, NexusError>>;
  /** Sign out of Google — wipes every google_* SecureStore key. */
  readonly disconnectGoogle: () => Promise<Result<void, NexusError>>;
  /** Re-read the SecureStore + DB state. Useful after returning from Vault. */
  readonly refresh: () => Promise<Result<void, NexusError>>;
  /** Hard wipe — used by Settings → factory reset. */
  readonly wipeAllCredentials: () => Promise<Result<void, NexusError>>;
}

const readEmail = async (provider: Provider): Promise<string | null> => {
  const r = await tokenService.getToken(provider, 'userEmail');
  return r.ok ? r.value : null;
};

export const useAuth = (): UseAuthApi => {
  const snapshot = useStore(getVaultStore(), (s) => s.snapshot);
  const connecting = useStore(getAuthStore(), (s) => s.connecting);
  const disconnecting = useStore(getAuthStore(), (s) => s.disconnecting);
  const lastError = useStore(getAuthStore(), (s) => s.lastError);

  const googleConnected = snapshot.google.status === 'connected';
  const [googleEmail, setGoogleEmail] = useState<string | null>(
    snapshot.google.userEmail,
  );

  // Re-read the email from SecureStore whenever google connection flips
  // — userEmail is written by setOAuthBundle and may not be in vault
  // snapshot if the snapshot was hydrated from an older session.
  useEffect(() => {
    if (!googleConnected) {
      setGoogleEmail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const email = await readEmail('google');
      if (!cancelled) setGoogleEmail(email);
    })();
    return () => {
      cancelled = true;
    };
  }, [googleConnected]);

  const connectGoogle = useCallback(
    async (clientId: string) =>
      getAuthStore().getState().connectGoogle(clientId),
    [],
  );

  const disconnectGoogle = useCallback(
    async () => getAuthStore().getState().disconnectGoogle(),
    [],
  );

  const refresh = useCallback(
    async () => getAuthStore().getState().checkConnection(),
    [],
  );

  const wipeAllCredentialsCb = useCallback(
    async () => tokenService.wipeAllCredentials(),
    [],
  );

  return {
    anyConnection: hasAnyConnection({ snapshot } as never),
    openAiConfigured: isOpenAiConfigured({ snapshot } as never),
    googleConnected,
    googleEmail,
    connecting,
    disconnecting,
    lastError,
    connectGoogle,
    disconnectGoogle,
    refresh,
    wipeAllCredentials: wipeAllCredentialsCb,
  };
};
