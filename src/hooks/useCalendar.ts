/**
 * useCalendar — Calendar-screen-facing API.
 *
 * Offline-first via eventRepository: load() returns cached events
 * immediately, then fires a network refresh in the background.
 *
 * Per LAW 9: components never call services; they go through this hook.
 */

import { useCallback, useState } from 'react';

import * as eventRepository from '../db/eventRepository';
import * as googleService from '../services/googleService';
import { type CalendarEvent, type CalendarEventInput } from '../types/tools';
import { type NexusError, type Result } from '../types/auth';

export type RangeKey = 'today' | 'week' | 'two_weeks';

export type CalendarLoadStatus =
  | 'idle'
  | 'loading_cache'
  | 'loading_network'
  | 'ready'
  | 'error';

export interface UseCalendarApi {
  readonly events: readonly CalendarEvent[];
  readonly range: RangeKey;
  readonly setRange: (next: RangeKey) => void;
  readonly status: CalendarLoadStatus;
  readonly error: NexusError | null;
  readonly load: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly createEvent: (
    event: CalendarEventInput,
  ) => Promise<Result<{ id: string; htmlLink: string | null }, NexusError>>;
}

const computeRange = (
  key: RangeKey,
  now: Date,
): { fromIso: string; toIso: string } => {
  const min = new Date(now);
  min.setHours(0, 0, 0, 0);
  const max = new Date(min);
  if (key === 'today') max.setDate(max.getDate() + 1);
  else if (key === 'week') max.setDate(max.getDate() + 7);
  else max.setDate(max.getDate() + 14);
  return { fromIso: min.toISOString(), toIso: max.toISOString() };
};

export const useCalendar = (initialRange: RangeKey = 'week'): UseCalendarApi => {
  const [events, setEvents] = useState<readonly CalendarEvent[]>([]);
  const [range, setRangeState] = useState<RangeKey>(initialRange);
  const [status, setStatus] = useState<CalendarLoadStatus>('idle');
  const [error, setError] = useState<NexusError | null>(null);

  const refreshFromNetwork = useCallback(async (): Promise<void> => {
    setStatus('loading_network');
    setError(null);
    const { fromIso, toIso } = computeRange(range, new Date());
    const result = await googleService.listCalendarEvents({
      timeMinIso: fromIso,
      timeMaxIso: toIso,
      limit: 50,
    });
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      return;
    }
    setEvents(result.value);
    setStatus('ready');
    void eventRepository.replaceInRange({
      fromIso,
      toIso,
      events: result.value,
    });
  }, [range]);

  const load = useCallback(async (): Promise<void> => {
    setStatus('loading_cache');
    setError(null);
    const { fromIso, toIso } = computeRange(range, new Date());
    const cached = await eventRepository.listInRange({ fromIso, toIso });
    if (cached.ok && cached.value.length > 0) {
      setEvents(cached.value);
    }
    await refreshFromNetwork();
  }, [range, refreshFromNetwork]);

  const setRange = useCallback((next: RangeKey): void => {
    setRangeState(next);
  }, []);

  const createEvent = useCallback(
    async (event: CalendarEventInput) => googleService.createCalendarEvent(event),
    [],
  );

  return {
    events,
    range,
    setRange,
    status,
    error,
    load,
    refresh: refreshFromNetwork,
    createEvent,
  };
};
