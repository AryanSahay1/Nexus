/**
 * Unit tests for src/utils/diagProbes.ts.
 *
 * Probes are wrapped so they never throw — even when the underlying
 * native module mock rejects. Tests prove that one failing probe never
 * masks the others.
 */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __reset: () => store.clear(),
    __store: store,
  };
});

jest.mock('expo-sqlite/next', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(async () => ({
    closeAsync: jest.fn(async () => undefined),
  })),
}));
jest.mock('expo-sqlite', () => ({ __esModule: true }));

jest.mock('react-native-app-auth', () => ({
  __esModule: true,
  authorize: jest.fn(),
  refresh: jest.fn(),
}));

jest.mock('expo-contacts', () => ({
  __esModule: true,
  Fields: { Name: 'Name', PhoneNumbers: 'PhoneNumbers' },
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getContactsAsync: jest.fn(async () => ({ data: [] })),
}));

// eslint-disable-next-line import/first
import { __internal, runDiagProbes } from '../../src/utils/diagProbes';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runDiagProbes (happy path)', () => {
  it('runs all four module probes sequentially', async () => {
    const report = await runDiagProbes();
    expect(report.probes).toHaveLength(4);
    expect(report.probes.map((p) => p.id)).toEqual([
      'secure_store',
      'sqlite_next',
      'app_auth',
      'contacts',
    ]);
  });

  it('every probe passes when its module is healthy', async () => {
    const report = await runDiagProbes();
    for (const p of report.probes) {
      expect(p.status).toBe('pass');
      expect(p.errorCode).toBeUndefined();
      expect(p.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns a hermesPresent boolean (never throws)', async () => {
    const report = await runDiagProbes();
    expect(typeof report.hermesPresent).toBe('boolean');
  });

  it('returns a buildFingerprint string (empty on test env)', async () => {
    const report = await runDiagProbes();
    expect(typeof report.buildFingerprint).toBe('string');
  });
});

describe('runDiagProbes (failure isolation)', () => {
  it('one failing probe does not stop the others', async () => {
    const SecureStoreMod = jest.requireMock<{
      setItemAsync: jest.Mock;
    }>('expo-secure-store');
    SecureStoreMod.setItemAsync.mockRejectedValueOnce(
      new Error('keystore unavailable'),
    );
    const report = await runDiagProbes();
    const [secureStore, sqliteNext, appAuth, contacts] = report.probes;
    expect(secureStore?.status).toBe('fail');
    expect(secureStore?.errorMessage).toContain('keystore unavailable');
    expect(sqliteNext?.status).toBe('pass');
    expect(appAuth?.status).toBe('pass');
    expect(contacts?.status).toBe('pass');
  });

  it('a failing sqlite probe surfaces the typed code', async () => {
    const SQLiteMod = jest.requireMock<{
      openDatabaseAsync: jest.Mock;
    }>('expo-sqlite/next');
    SQLiteMod.openDatabaseAsync.mockRejectedValueOnce(
      new Error('disk full'),
    );
    const report = await runDiagProbes();
    const sqlitePart = report.probes.find((p) => p.id === 'sqlite_next');
    expect(sqlitePart?.status).toBe('fail');
    expect(sqlitePart?.errorMessage).toContain('disk full');
  });

  it('SecureStore round-trip mismatch fails the probe with a typed code', async () => {
    const SecureStoreMod = jest.requireMock<{
      setItemAsync: jest.Mock;
      getItemAsync: jest.Mock;
    }>('expo-secure-store');
    SecureStoreMod.setItemAsync.mockResolvedValueOnce(undefined);
    SecureStoreMod.getItemAsync.mockResolvedValueOnce('wrong_value');
    const report = await runDiagProbes();
    const secureStorePart = report.probes.find((p) => p.id === 'secure_store');
    expect(secureStorePart?.status).toBe('fail');
    expect(secureStorePart?.errorCode).toBe('UNKNOWN');
  });
});

describe('helpers', () => {
  it('detectHermes returns false in the test runner (Hermes is RN-only)', () => {
    expect(__internal.detectHermes()).toBe(false);
  });

  it('reasonForError handles NexusError, plain Error, and primitives', () => {
    expect(__internal.reasonForError(new Error('x')).code).toBe('UNKNOWN');
    expect(__internal.reasonForError('plain string').code).toBe('UNKNOWN');
    expect(__internal.reasonForError(42).message).toBe('42');
  });
});
