/**
 * Tool executors for Google Calendar.
 */

import * as googleService from '../services/googleService';
import {
  type CalendarEvent,
  type CalendarEventInput,
  type GoogleCalendarCreateEventResult,
} from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';

/** Validate the raw argument record from the LLM. */
export const parseCalendarCreateEventParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<CalendarEventInput, NexusError> => {
  const summary = raw['summary'];
  const startIso = raw['start_time'];
  const endIso = raw['end_time'];
  const description = raw['description'];
  const attendeesRaw = raw['attendees'];
  const timezone = raw['timezone'];

  if (typeof summary !== 'string' || summary.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'calendar.create: summary is required.'));
  }
  if (typeof startIso !== 'string' || Number.isNaN(Date.parse(startIso))) {
    return err(new NexusError('INVALID_INPUT', 'calendar.create: start_time must be ISO 8601.'));
  }
  if (typeof endIso !== 'string' || Number.isNaN(Date.parse(endIso))) {
    return err(new NexusError('INVALID_INPUT', 'calendar.create: end_time must be ISO 8601.'));
  }
  let attendees: string[] | undefined;
  if (Array.isArray(attendeesRaw)) {
    attendees = [];
    for (const a of attendeesRaw) {
      if (typeof a !== 'string') {
        return err(
          new NexusError('INVALID_INPUT', 'calendar.create: attendees must be strings.'),
        );
      }
      attendees.push(a);
    }
  }
  return ok({
    summary,
    startIso,
    endIso,
    ...(typeof description === 'string' ? { description } : {}),
    ...(typeof timezone === 'string' && timezone.length > 0 ? { timezone } : {}),
    ...(attendees !== undefined ? { attendees } : {}),
  });
};

export const googleCalendarCreateEvent = async (
  params: CalendarEventInput,
): Promise<Result<GoogleCalendarCreateEventResult, NexusError>> => {
  const result = await googleService.createCalendarEvent(params);
  if (!result.ok) return err(result.error);
  return ok({ id: result.value.id, htmlLink: result.value.htmlLink });
};

export const googleCalendarGetNext = async (): Promise<Result<CalendarEvent | null, NexusError>> =>
  googleService.getNextCalendarEvent();

/** Human-readable summary for the ConfirmationCard. */
export const summarizeCreateEvent = (params: CalendarEventInput): string => {
  const startLocal = new Date(params.startIso);
  const endLocal = new Date(params.endIso);
  const attendees =
    params.attendees && params.attendees.length > 0
      ? `\nAttendees: ${params.attendees.join(', ')}`
      : '';
  return `Create calendar event "${params.summary}"\nFrom: ${startLocal.toISOString()}\nTo:   ${endLocal.toISOString()}${attendees}`;
};
