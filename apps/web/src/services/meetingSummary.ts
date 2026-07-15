// Per-meeting session summary — request + poll against senseiapi.
import { apiRequest, isApiConfigured } from './apiClient';

export type MeetingSummaryStatus = 'pending' | 'running' | 'ready' | 'failed';

export interface MeetingSummary {
  meeting_id: string
  status: MeetingSummaryStatus
  text?: string | null
  model?: string | null
  error?: string | null
  /** Short per-session clinical insight shown on the session-detail screen. */
  insight?: string | null
}

const POLL_MS = 2000;
const MAX_WAIT_MS = 10 * 60 * 1000;

function pathFor(meetingId: string): string {
  return '/meetings/' + encodeURIComponent(meetingId) + '/summary';
}

export async function requestMeetingSummary(
  meetingId: string,
  signal?: AbortSignal,
): Promise<MeetingSummary> {
  return apiRequest<MeetingSummary>(pathFor(meetingId), {
    method: 'POST',
    signal,
    timeoutMs: 30000,
  });
}

export async function fetchMeetingSummary(
  meetingId: string,
  signal?: AbortSignal,
): Promise<MeetingSummary> {
  return apiRequest<MeetingSummary>(pathFor(meetingId), {
    method: 'GET',
    signal,
    timeoutMs: 30000,
  });
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pollUntilSettled(
  meetingId: string,
  summary: MeetingSummary,
  opts: { signal?: AbortSignal; onUpdate?: (s: MeetingSummary) => void },
): Promise<MeetingSummary> {
  opts.onUpdate?.(summary);
  const started = Date.now();
  let current = summary;
  while (current.status === 'pending' || current.status === 'running') {
    if (Date.now() - started > MAX_WAIT_MS) {
      throw Object.assign(new Error('Summary generation timed out'), { code: 'TIMEOUT' });
    }
    await wait(POLL_MS, opts.signal);
    current = await fetchMeetingSummary(meetingId, opts.signal);
    opts.onUpdate?.(current);
  }
  return current;
}

/**
 * Prefer existing summary (GET). POST when missing or failed so therapists can
 * retry after Ollama / model issues without re-uploading audio.
 */
export async function pollMeetingSummary(
  meetingId: string,
  opts: { signal?: AbortSignal; onUpdate?: (s: MeetingSummary) => void } = {},
): Promise<MeetingSummary> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }

  let summary: MeetingSummary | null = null;
  try {
    summary = await fetchMeetingSummary(meetingId, opts.signal);
  } catch (e: any) {
    if (e?.status !== 404) throw e;
  }

  if (!summary || summary.status === 'failed') {
    summary = await requestMeetingSummary(meetingId, opts.signal);
  }

  return pollUntilSettled(meetingId, summary, opts);
}

/** Pull bullet lines under a ## heading from a Hebrew markdown summary. */
export function bulletsUnderHeading(text: string, heading: string): string[] {
  const lines = text.split(/\r?\n/);
  const items: string[] = [];
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      inSection = line.replace(/^##\s+/, '').trim() === heading.trim()
        || line.includes(heading.trim());
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      items.push(line.slice(2).trim());
    }
  }
  return items.filter(Boolean);
}
