/**
 * Drive tools — list recent files, read a Google Doc as plain text.
 */

import { type DriveDocContent, type DriveFile } from '../types/google';
import { NexusError, type Result, err, ok } from '../types/auth';
import * as googleService from '../services/googleService';

// ── list_drive_files ------------------------------------------------------

export interface DriveListParams {
  readonly limit: number;
  readonly query?: string;
}

export const parseDriveListParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<DriveListParams, NexusError> => {
  const limitRaw = raw['limit'];
  const queryRaw = raw['query'];
  let limit = 10;
  if (limitRaw !== undefined) {
    if (typeof limitRaw !== 'number' || !Number.isFinite(limitRaw)) {
      return err(new NexusError('INVALID_INPUT', 'drive_list_recent: limit must be a number.'));
    }
    limit = Math.floor(limitRaw);
  }
  if (queryRaw !== undefined && typeof queryRaw !== 'string') {
    return err(new NexusError('INVALID_INPUT', 'drive_list_recent: query must be a string.'));
  }
  return ok({
    limit,
    ...(typeof queryRaw === 'string' && queryRaw.length > 0 ? { query: queryRaw } : {}),
  });
};

export const driveListRecent = async (
  params: DriveListParams,
): Promise<Result<{ files: readonly DriveFile[] }, NexusError>> => {
  const result = await googleService.listDriveFiles(params);
  if (!result.ok) return err(result.error);
  return ok({ files: result.value });
};

// ── read_document ---------------------------------------------------------

export interface DriveReadParams {
  readonly fileId: string;
}

export const parseDriveReadParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<DriveReadParams, NexusError> => {
  const id = raw['file_id'];
  if (typeof id !== 'string' || id.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'drive_read_doc: file_id is required.'));
  }
  return ok({ fileId: id.trim() });
};

export const driveReadDoc = async (
  params: DriveReadParams,
): Promise<Result<DriveDocContent, NexusError>> => googleService.exportDriveDocAsText(params.fileId);
