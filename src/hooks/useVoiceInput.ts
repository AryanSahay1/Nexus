/**
 * Voice-input hook.
 *
 * Wraps `expo-av` recording + `openaiService.transcribeAudio()` behind a
 * stable, Result-typed surface. Following the LAW playbook:
 *   - Permission denial returns `err(NexusError)` with code
 *     `PERMISSION_DENIED` instead of throwing.
 *   - Every other failure path returns `err(NexusError)` too — the hook
 *     never throws across its boundary (LAW 3 / LAW 6).
 *   - The transcript is held in hook state and exposed read-only; the
 *     consumer is responsible for clearing it after consuming.
 *
 * Testability: every imperative step is implemented as a pure module-level
 * function (`runStartRecording`, `runStopAndTranscribe`) that the hook
 * composes with `useState`. The pure functions are unit-tested directly;
 * the React composition is verified by Detox in `e2e/flows`.
 */

import { Audio } from 'expo-av';
import { useCallback, useRef, useState } from 'react';

import { transcribeAudio } from '../services/openaiService';
import { NexusError, type Result, err, ok } from '../types/auth';
import { logError, logEvent } from '../utils/logger';

// ── Backend abstraction (test seam) ───────────────────────────────────────

export interface VoiceBackend {
  requestPermissionsAsync: () => Promise<{ status: 'granted' | 'denied' | 'undetermined' }>;
  setAudioModeAsync: (mode: Readonly<Record<string, boolean>>) => Promise<void>;
  createRecording: () => Promise<{
    recording: VoiceRecordingHandle;
    status: unknown;
  }>;
}
export interface VoiceRecordingHandle {
  stopAndUnloadAsync: () => Promise<void>;
  getURI: () => string | null;
}

const liveBackend: VoiceBackend = {
  requestPermissionsAsync: async () => Audio.requestPermissionsAsync(),
  setAudioModeAsync: async (mode) => {
    await Audio.setAudioModeAsync(mode);
  },
  createRecording: async () => {
    const { recording, status } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    return {
      recording: {
        stopAndUnloadAsync: async (): Promise<void> => {
          await recording.stopAndUnloadAsync();
        },
        getURI: (): string | null => recording.getURI(),
      },
      status,
    };
  },
};

let backendOverride: VoiceBackend | null = null;
export const __setVoiceBackendForTests = (backend: VoiceBackend | null): void => {
  backendOverride = backend;
};
const getBackend = (): VoiceBackend => backendOverride ?? liveBackend;

// ── Pure step functions (unit-tested directly) ────────────────────────────

/**
 * Asks for the microphone permission, sets the audio mode, and starts a
 * recording. Returns the recording handle on success, a typed error on
 * permission denial / native failure.
 */
export const runStartRecording = async (
  backend: VoiceBackend,
): Promise<Result<VoiceRecordingHandle, NexusError>> => {
  const permission = await backend.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return err(
      new NexusError(
        'PERMISSION_DENIED',
        'Microphone permission denied. Enable it in system settings.',
      ),
    );
  }
  try {
    await backend.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording } = await backend.createRecording();
    logEvent('voice_recording_started', {});
    return ok(recording);
  } catch (cause) {
    logError('voice_recording_start_failed', {});
    return err(
      new NexusError('PROVIDER_ERROR', 'Failed to start recording.', {
        isRetryable: true,
        cause,
      }),
    );
  }
};

/**
 * Stops the active recording and feeds the resulting audio file to the
 * transcribe function. Returns the transcript string on success.
 */
export const runStopAndTranscribe = async (
  handle: VoiceRecordingHandle,
  transcribe: typeof transcribeAudio,
): Promise<Result<string, NexusError>> => {
  let uri: string | null;
  try {
    await handle.stopAndUnloadAsync();
    uri = handle.getURI();
  } catch (cause) {
    logError('voice_recording_stop_failed', {});
    return err(
      new NexusError('PROVIDER_ERROR', 'Failed to stop recording.', {
        isRetryable: true,
        cause,
      }),
    );
  }
  if (uri === null || uri.length === 0) {
    return err(new NexusError('PROVIDER_ERROR', 'Recording finished with no URI.'));
  }
  const transcribed = await transcribe({ uri });
  if (!transcribed.ok) return err(transcribed.error);
  logEvent('voice_transcription_ok', {});
  return ok(transcribed.value.text);
};

// ── React hook (thin wrapper that composes the pure steps with state) ────

export interface UseVoiceInputApi {
  readonly isRecording: boolean;
  readonly isTranscribing: boolean;
  readonly transcript: string | null;
  readonly error: NexusError | null;
  readonly startRecording: () => Promise<Result<void, NexusError>>;
  readonly stopRecording: () => Promise<Result<string, NexusError>>;
  readonly reset: () => void;
}
interface UseVoiceInputOptions {
  readonly transcribe?: typeof transcribeAudio;
}

export const useVoiceInput = (options: UseVoiceInputOptions = {}): UseVoiceInputApi => {
  const transcribe = options.transcribe ?? transcribeAudio;
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<NexusError | null>(null);
  const recordingRef = useRef<VoiceRecordingHandle | null>(null);

  const startRecording = useCallback(async (): Promise<Result<void, NexusError>> => {
    setError(null);
    setTranscript(null);
    if (isRecording) {
      const e = new NexusError('INVALID_INPUT', 'Already recording.');
      setError(e);
      return err(e);
    }
    const result = await runStartRecording(getBackend());
    if (!result.ok) {
      setError(result.error);
      return err(result.error);
    }
    recordingRef.current = result.value;
    setIsRecording(true);
    return ok(undefined);
  }, [isRecording]);

  const stopRecording = useCallback(async (): Promise<Result<string, NexusError>> => {
    if (!isRecording || recordingRef.current === null) {
      const e = new NexusError('INVALID_INPUT', 'No recording in progress.');
      setError(e);
      return err(e);
    }
    const handle = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    setIsTranscribing(true);
    const result = await runStopAndTranscribe(handle, transcribe);
    setIsTranscribing(false);
    if (!result.ok) {
      setError(result.error);
      return err(result.error);
    }
    setTranscript(result.value);
    return ok(result.value);
  }, [isRecording, transcribe]);

  const reset = useCallback((): void => {
    setTranscript(null);
    setError(null);
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcript,
    error,
    startRecording,
    stopRecording,
    reset,
  };
};
