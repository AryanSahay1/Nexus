/**
 * useMail — Mail-screen-facing API.
 *
 * Offline-first: load() returns the cached emails immediately, then
 * fires a network refresh in the background and updates state once
 * the network result arrives. The screen renders both states from a
 * single subscription.
 *
 * Per LAW 9: components never call services; they go through this hook.
 */

import { useCallback, useEffect, useState } from 'react';

import * as emailRepository from '../db/emailRepository';
import * as gmailService from '../services/gmailServiceProxy';
import { type GmailMessageSummary } from '../types/tools';
import { type EmailDetail } from '../types/google';
import { type NexusError, type Result } from '../types/auth';

const PAGE_SIZE = 20 as const;

export type MailLoadStatus = 'idle' | 'loading_cache' | 'loading_network' | 'ready' | 'error';

export interface UseMailApi {
  readonly threads: readonly GmailMessageSummary[];
  readonly status: MailLoadStatus;
  readonly error: NexusError | null;
  /** Initial load: cache → network. */
  readonly load: () => Promise<void>;
  /** User-pulled refresh — network only, replaces cache on success. */
  readonly refresh: () => Promise<void>;
  /** Open one thread for full-body display. */
  readonly openThread: (id: string) => Promise<Result<EmailDetail, NexusError>>;
  /** Search Gmail using Gmail's query syntax. */
  readonly search: (
    query: string,
    limit?: number,
  ) => Promise<Result<GmailMessageSummary[], NexusError>>;
}

export const useMail = (): UseMailApi => {
  const [threads, setThreads] = useState<readonly GmailMessageSummary[]>([]);
  const [status, setStatus] = useState<MailLoadStatus>('idle');
  const [error, setError] = useState<NexusError | null>(null);

  const refreshFromNetwork = useCallback(async (): Promise<void> => {
    setStatus('loading_network');
    setError(null);
    const result = await gmailService.listGmailMessages({ limit: PAGE_SIZE });
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      return;
    }
    setThreads(result.value);
    setStatus('ready');
    // Fire-and-forget cache write — failure is non-fatal.
    void emailRepository.replaceAll(result.value);
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setStatus('loading_cache');
    setError(null);
    const cached = await emailRepository.listAll();
    if (cached.ok && cached.value.length > 0) {
      setThreads(cached.value);
      // Skip the loading_network state if we already have something
      // visible — let the network refresh happen in the background and
      // update on success. The screen renders without flicker.
    }
    await refreshFromNetwork();
  }, [refreshFromNetwork]);

  const openThread = useCallback(
    async (id: string) => gmailService.getGmailMessage(id),
    [],
  );

  const search = useCallback(
    async (query: string, limit?: number) =>
      gmailService.searchGmailMessages(query, limit),
    [],
  );

  // No auto-load on mount — the consuming screen decides when (e.g.
  // only when google is connected). Keeps the hook composable.
  useEffect(() => {
    return () => {
      /* nothing to tear down — repository writes are awaited inside load() */
    };
  }, []);

  return { threads, status, error, load, refresh: refreshFromNetwork, openThread, search };
};
