/**
 * On-device diagnostic probes.
 *
 * Each probe tries to load and minimally exercise one native module.
 * Probes never throw — they always resolve to a typed `ProbeResult` so
 * the diagnostic screen can render every row even if one fails.
 *
 * The screen is the only consumer; production code paths must not call
 * these. Diagnostic mode bypasses bootstrap so it must NOT depend on
 * any module that bootstrap configures.
 */

import * as SecureStore from 'expo-secure-store';

import { NexusError } from '../types/auth';

export type ProbeStatus = 'pending' | 'pass' | 'fail';

export interface ProbeResult {
  readonly id: string;
  readonly label: string;
  readonly status: ProbeStatus;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly latencyMs?: number;
}

export interface DiagReport {
  readonly probes: readonly ProbeResult[];
  readonly hermesPresent: boolean;
  readonly buildFingerprint: string;
}

const reasonForError = (caught: unknown): { code: string; message: string } => {
  if (caught instanceof NexusError) {
    return { code: caught.code, message: caught.message };
  }
  if (caught instanceof Error) {
    return { code: 'UNKNOWN', message: caught.message };
  }
  return { code: 'UNKNOWN', message: String(caught) };
};

const timed = async (
  id: string,
  label: string,
  body: () => Promise<void>,
): Promise<ProbeResult> => {
  const start = Date.now();
  try {
    await body();
    return { id, label, status: 'pass', latencyMs: Date.now() - start };
  } catch (caught) {
    const { code, message } = reasonForError(caught);
    return {
      id,
      label,
      status: 'fail',
      errorCode: code,
      errorMessage: message,
      latencyMs: Date.now() - start,
    };
  }
};

const probeSecureStore = (): Promise<ProbeResult> =>
  timed('secure_store', 'expo-secure-store', async () => {
    await SecureStore.setItemAsync('nexus_diag_marker', 'ok');
    const v = await SecureStore.getItemAsync('nexus_diag_marker');
    if (v !== 'ok') throw new NexusError('UNKNOWN', 'round-trip mismatch');
    await SecureStore.deleteItemAsync('nexus_diag_marker');
  });

const probeSqliteNext = (): Promise<ProbeResult> =>
  timed('sqlite_next', 'expo-sqlite/next', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('expo-sqlite/next') as unknown;
    if (
      typeof mod !== 'object' ||
      mod === null ||
      typeof (mod as { openDatabaseAsync?: unknown }).openDatabaseAsync !== 'function'
    ) {
      throw new NexusError('UNKNOWN', 'openDatabaseAsync not exposed');
    }
    const db = await (
      mod as { openDatabaseAsync: (n: string) => Promise<{ closeAsync: () => Promise<void> }> }
    ).openDatabaseAsync('nexus_diag.db');
    await db.closeAsync();
  });

const probeAppAuthLoad = (): Promise<ProbeResult> =>
  timed('app_auth', 'react-native-app-auth (load only)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('react-native-app-auth') as unknown;
    if (typeof mod !== 'object' || mod === null) {
      throw new NexusError('UNKNOWN', 'module loaded but is not an object');
    }
    if (typeof (mod as { authorize?: unknown }).authorize !== 'function') {
      throw new NexusError('UNKNOWN', '.authorize not exported');
    }
  });

const probeContactsLoad = (): Promise<ProbeResult> =>
  timed('contacts', 'expo-contacts (load only)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('expo-contacts') as unknown;
    if (typeof mod !== 'object' || mod === null) {
      throw new NexusError('UNKNOWN', 'module loaded but is not an object');
    }
    if (typeof (mod as { Fields?: unknown }).Fields !== 'object') {
      throw new NexusError('UNKNOWN', '.Fields not exported');
    }
  });

const detectHermes = (): boolean => {
  const g = globalThis as unknown as { HermesInternal?: unknown };
  return typeof g.HermesInternal === 'object' && g.HermesInternal !== null;
};

const detectBuildFingerprint = (): string => {
  // No reliable cross-platform way without expo-application; we lazy-load
  // it to keep this module dep-free. If it fails, return the empty
  // string so the screen renders without it.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('expo-application') as unknown;
    if (
      typeof mod === 'object' &&
      mod !== null &&
      typeof (mod as { nativeBuildVersion?: unknown }).nativeBuildVersion === 'string'
    ) {
      const m = mod as {
        nativeBuildVersion: string;
        nativeApplicationVersion?: string | null;
      };
      return `${m.nativeApplicationVersion ?? '?'}+${m.nativeBuildVersion}`;
    }
  } catch {
    /* tolerate */
  }
  return '';
};

/** Run every probe sequentially and return the full report. Never throws. */
export const runDiagProbes = async (): Promise<DiagReport> => {
  const probes: ProbeResult[] = [];
  // Sequence matters — run secure_store first because the diag entry
  // path itself is gated by it via the crash sentinel.
  probes.push(await probeSecureStore());
  probes.push(await probeSqliteNext());
  probes.push(await probeAppAuthLoad());
  probes.push(await probeContactsLoad());
  return {
    probes,
    hermesPresent: detectHermes(),
    buildFingerprint: detectBuildFingerprint(),
  };
};

export const __internal = {
  reasonForError,
  detectHermes,
  detectBuildFingerprint,
};
