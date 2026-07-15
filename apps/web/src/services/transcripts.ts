// Meeting transcript read — GET /meetings/{id}/transcript against senseiapi.
import { apiRequest, isApiConfigured } from './apiClient';

export interface TranscriptSegment {
  speaker: string
  text: string
}

export interface MeetingTranscript {
  meeting_id: string
  language: string
  raw_text: string
  segments: TranscriptSegment[]
}

function pathFor(meetingId: string): string {
  return '/meetings/' + encodeURIComponent(meetingId) + '/transcript';
}

/** Fetches a meeting's stored transcript. Throws NO_API when the backend is unset. */
export async function fetchMeetingTranscript(
  meetingId: string,
  signal?: AbortSignal,
): Promise<MeetingTranscript> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  return apiRequest<MeetingTranscript>(pathFor(meetingId), { method: 'GET', signal });
}
