/**
 * Unit tests for src/hooks/useVoiceInput.ts.
 *
 * The React-bound hook glue is verified end-to-end by Detox flow #3 (`chat`)
 * which exercises the full mic → transcript → input-bar pipeline. These
 * unit tests pin the pure step functions that the hook composes:
 *
 *   - `runStartRecording`  permission gate + native start
 *   - `runStopAndTranscribe`  native stop + Whisper round-trip
 *
 * Permission denied, transcription failure, and isRecording-style state
 * transitions are all exercised through these pure helpers.
 */

jest.mock('expo-av', () => ({
  __esModule: true,
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: {
      createAsync: jest.fn(),
    },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

// expo-secure-store is reached transitively via openaiService → apiClient
// → tokenService. Stub it so the unit test stays in pure-Node land.
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({ __esModule: true }));

import {
  runStartRecording,
  runStopAndTranscribe,
  type VoiceBackend,
  type VoiceRecordingHandle,
} from '../../src/hooks/useVoiceInput';
import { NexusError, type Result, err, ok } from '../../src/types/auth';

const buildBackend = (overrides: {
  permission?: 'granted' | 'denied' | 'undetermined';
  startThrows?: boolean;
} = {}): VoiceBackend => ({
  requestPermissionsAsync: jest.fn(async () => ({
    status: overrides.permission ?? 'granted',
  })),
  setAudioModeAsync: jest.fn(async () => undefined),
  createRecording: jest.fn(async () => {
    if (overrides.startThrows === true) throw new Error('start blew up');
    return {
      recording: {
        stopAndUnloadAsync: jest.fn(async () => undefined),
        getURI: () => 'file:///tmp/audio.m4a',
      },
      status: {},
    };
  }),
});

const buildHandle = (overrides: {
  uri?: string | null;
  stopThrows?: boolean;
} = {}): VoiceRecordingHandle => ({
  stopAndUnloadAsync: jest.fn(async () => {
    if (overrides.stopThrows === true) throw new Error('stop blew up');
  }),
  getURI: () => (overrides.uri === undefined ? 'file:///tmp/audio.m4a' : overrides.uri),
});

describe('runStartRecording — permission denied', () => {
  it('returns PERMISSION_DENIED without invoking createRecording', async () => {
    const backend = buildBackend({ permission: 'denied' });
    const result = await runStartRecording(backend);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PERMISSION_DENIED');
      expect(result.error.isRetryable).toBe(false);
    }
    expect(backend.createRecording).not.toHaveBeenCalled();
    expect(backend.setAudioModeAsync).not.toHaveBeenCalled();
  });

  it('treats undetermined like denied', async () => {
    const backend = buildBackend({ permission: 'undetermined' });
    const result = await runStartRecording(backend);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PERMISSION_DENIED');
  });
});

describe('runStartRecording — happy path', () => {
  it('sets the audio mode, starts the recording, and returns the handle', async () => {
    const backend = buildBackend();
    const result = await runStartRecording(backend);
    expect(result.ok).toBe(true);
    expect(backend.setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(backend.createRecording).toHaveBeenCalledTimes(1);
    if (result.ok) {
      expect(typeof result.value.stopAndUnloadAsync).toBe('function');
    }
  });
});

describe('runStartRecording — native start failure', () => {
  it('returns PROVIDER_ERROR when createRecording throws', async () => {
    const backend = buildBackend({ startThrows: true });
    const result = await runStartRecording(backend);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.isRetryable).toBe(true);
    }
  });
});

describe('runStopAndTranscribe — happy path', () => {
  it('returns the transcript text', async () => {
    const handle = buildHandle();
    const transcribe = jest.fn(
      async (): Promise<Result<{ text: string }, NexusError>> => ok({ text: 'hello world' }),
    );
    const result = await runStopAndTranscribe(handle, transcribe);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('hello world');
    expect(handle.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    expect(transcribe).toHaveBeenCalledWith({ uri: 'file:///tmp/audio.m4a' });
  });
});

describe('runStopAndTranscribe — failure paths', () => {
  it('returns PROVIDER_ERROR when stopAndUnloadAsync throws', async () => {
    const handle = buildHandle({ stopThrows: true });
    const transcribe = jest.fn(async () => ok({ text: 'never' }));
    const result = await runStopAndTranscribe(handle, transcribe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_ERROR');
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('returns PROVIDER_ERROR when the stopped recording has no URI', async () => {
    const handle = buildHandle({ uri: null });
    const transcribe = jest.fn(async () => ok({ text: 'never' }));
    const result = await runStopAndTranscribe(handle, transcribe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('no URI');
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('propagates the transcribeAudio NETWORK_ERROR', async () => {
    const handle = buildHandle();
    const transcribe = jest.fn(
      async () => err(new NexusError('NETWORK_ERROR', 'whisper offline', { isRetryable: true })),
    );
    const result = await runStopAndTranscribe(handle, transcribe);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.isRetryable).toBe(true);
    }
  });
});
