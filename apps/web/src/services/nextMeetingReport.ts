// Next-meeting prep report — request + poll against senseiapi.
import { apiRequest, isApiConfigured } from './apiClient';

export type NextMeetingReportStatus = 'pending' | 'running' | 'ready' | 'failed';

export interface NextMeetingReport {
  patient_id: string
  meeting_id?: string | null
  status: NextMeetingReportStatus
  intro?: string | null
  changes?: string[] | null
  open_topics?: string[] | null
  source_meeting_ids?: string[] | null
  last_summary_excerpt?: string | null
  generated_at?: string | null
  model?: string | null
  error?: string | null
}

const POLL_MS = 1500;
const MAX_WAIT_MS = 5 * 60 * 1000;

function pathForMeeting(patientId: string, meetingId: string): string {
  return '/patients/' + encodeURIComponent(patientId) + '/meeting-reports/' + encodeURIComponent(meetingId);
}

function pathForNext(patientId: string): string {
  return '/patients/' + encodeURIComponent(patientId) + '/next-meeting-report';
}

function reportPath(patientId: string, meetingId?: string): string {
  return meetingId ? pathForMeeting(patientId, meetingId) : pathForNext(patientId);
}

export async function requestMeetingReport(
  patientId: string,
  meetingId: string,
  signal?: AbortSignal,
): Promise<NextMeetingReport> {
  return apiRequest<NextMeetingReport>(pathForMeeting(patientId, meetingId), {
    method: 'POST',
    signal,
    timeoutMs: 30000,
  });
}

export async function fetchMeetingReport(
  patientId: string,
  meetingId: string,
  signal?: AbortSignal,
): Promise<NextMeetingReport> {
  return apiRequest<NextMeetingReport>(pathForMeeting(patientId, meetingId), {
    method: 'GET',
    signal,
    timeoutMs: 30000,
  });
}

export async function requestNextMeetingReport(
  patientId: string,
  signal?: AbortSignal,
): Promise<NextMeetingReport> {
  return apiRequest<NextMeetingReport>(pathForNext(patientId), {
    method: 'POST',
    signal,
    timeoutMs: 30000,
  });
}

export async function fetchNextMeetingReport(
  patientId: string,
  signal?: AbortSignal,
): Promise<NextMeetingReport> {
  return apiRequest<NextMeetingReport>(pathForNext(patientId), {
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
  patientId: string,
  report: NextMeetingReport,
  opts: {
    signal?: AbortSignal
    onUpdate?: (report: NextMeetingReport) => void
    meetingId?: string
  },
): Promise<NextMeetingReport> {
  opts.onUpdate?.(report);
  const started = Date.now();
  let current = report;
  const meetingId = opts.meetingId || current.meeting_id || undefined;
  while (current.status === 'pending' || current.status === 'running') {
    if (Date.now() - started > MAX_WAIT_MS) {
      throw Object.assign(new Error('Report generation timed out'), { code: 'TIMEOUT' });
    }
    await wait(POLL_MS, opts.signal);
    if (meetingId) {
      current = await fetchMeetingReport(patientId, meetingId, opts.signal);
    } else {
      current = await fetchNextMeetingReport(patientId, opts.signal);
    }
    opts.onUpdate?.(current);
  }
  return current;
}

/**
 * Prefer an existing report (GET). Only POST when none exists yet, then poll
 * until ready/failed — avoids wiping a ready report by re-POSTing from ReportPage.
 * Pass meetingId to target a specific calendar event; omit to use next-meeting resolver.
 */
export async function pollNextMeetingReport(
  patientId: string,
  opts: {
    signal?: AbortSignal
    onUpdate?: (report: NextMeetingReport) => void
    meetingId?: string
  } = {},
): Promise<NextMeetingReport> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }

  let report: NextMeetingReport | null = null;
  const fetchReport = opts.meetingId
    ? () => fetchMeetingReport(patientId, opts.meetingId!, opts.signal)
    : () => fetchNextMeetingReport(patientId, opts.signal);
  const requestReport = opts.meetingId
    ? () => requestMeetingReport(patientId, opts.meetingId!, opts.signal)
    : () => requestNextMeetingReport(patientId, opts.signal);

  try {
    report = await fetchReport();
  } catch (e: any) {
    if (e?.status !== 404) throw e;
  }

  if (!report) {
    try {
      report = await requestReport();
    } catch (e: any) {
      // GET 404'd AND POST 404/405'd: the route itself is absent — the deployed
      // senseiapi does not implement next-meeting reports yet (documented
      // backend blocker in docs/INTEGRATION.md). Callers fall back to the
      // local deterministic report instead of surfacing an error.
      if (e?.status === 404 || e?.status === 405) {
        throw Object.assign(new Error('next-meeting report endpoint not available'), {
          code: 'NOT_AVAILABLE', status: e.status,
        });
      }
      throw e;
    }
  }

  return pollUntilSettled(patientId, report, opts);
}

/**
 * Force a fresh report: POST (wipes the current row to pending and regenerates),
 * then poll until ready/failed. Unlike pollNextMeetingReport, this always POSTs.
 */
export async function regenerateNextMeetingReport(
  patientId: string,
  opts: {
    signal?: AbortSignal
    onUpdate?: (report: NextMeetingReport) => void
    meetingId?: string
  } = {},
): Promise<NextMeetingReport> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  let started: NextMeetingReport;
  try {
    started = opts.meetingId
      ? await requestMeetingReport(patientId, opts.meetingId, opts.signal)
      : await requestNextMeetingReport(patientId, opts.signal);
  } catch (e: any) {
    if (e?.status === 404 || e?.status === 405) {
      throw Object.assign(new Error('next-meeting report endpoint not available'), {
        code: 'NOT_AVAILABLE', status: e.status,
      });
    }
    throw e;
  }
  return pollUntilSettled(patientId, started, opts);
}

export function meetingReportPath(patientId: string, meetingId?: string): string {
  return reportPath(patientId, meetingId);
}
