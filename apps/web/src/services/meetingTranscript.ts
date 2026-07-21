// Probe / delete whether a meeting already has a stored transcript.
import { apiRequest, isApiConfigured } from './apiClient';

export interface MeetingTranscriptProbe {
  meeting_id: string
  transcript_id: string
  excerpt?: string | null
}

function pathFor(meetingId: string): string {
  return '/meetings/' + encodeURIComponent(meetingId) + '/transcript';
}

export async function fetchMeetingTranscript(
  meetingId: string,
  signal?: AbortSignal,
): Promise<MeetingTranscriptProbe | null> {
  if (!isApiConfigured() || !meetingId) return null;
  try {
    return await apiRequest<MeetingTranscriptProbe>(pathFor(meetingId), {
      method: 'GET',
      signal,
      timeoutMs: 15000,
    });
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

/**
 * Delete the meeting transcript and its AI summary so a new recording can be
 * uploaded. 404 means nothing to clear (already empty) — treated as success.
 */
export async function deleteMeetingTranscript(
  meetingId: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!isApiConfigured() || !meetingId) return;
  try {
    await apiRequest<void>(pathFor(meetingId), {
      method: 'DELETE',
      signal,
      timeoutMs: 30000,
    });
  } catch (e: any) {
    if (e?.status === 404) return;
    throw e;
  }
}
