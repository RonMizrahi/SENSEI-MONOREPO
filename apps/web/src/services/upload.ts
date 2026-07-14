// Upload pipeline — simulated processing when offline/API unavailable, real queue when offline.
import { isApiConfigured } from './apiClient';
import { getApiAccessToken } from './apiAuth';
import { enqueueUpload, listPendingUploads, removePendingUpload } from './uploadQueue';

export type UploadProgressFn = (progress: number) => void;

/** True when uploads use the simulated pipeline (no backend). */
export function usesMockUploadPipeline(): boolean {
  return !isApiConfigured();
}

/** Demo recording file — same idea as the drag-and-drop fallback sample. */
export function buildMockRecordingFile(): File {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return new File(['mock-session-audio'], 'recording-' + ts + '.mp3', { type: 'audio/mpeg' });
}

export interface SubmitUploadOpts {
  patientId: string
  sessionDate?: string
  /** Calendar event UUID (required when API is configured). */
  meetingId?: string
  online: boolean
  onProgress: UploadProgressFn
  signal?: AbortSignal
}

export interface StoredTranscript {
  audioId: string
  text: string
  language: string
  createdAt: string
  meetingId?: string
  transcriptId?: string
}

export interface SubmitUploadResult {
  status: 'success' | 'queued'
  queueId?: string
  audioId?: string
  transcript?: { text: string; language: string; meetingId?: string; transcriptId?: string }
}

function todayKey(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

/** Simulated staged upload + processing (demo / no API). */
export async function simulateUploadProgress(onProgress: UploadProgressFn, signal?: AbortSignal): Promise<void> {
  let p = 0;
  while (p < 100) {
    await wait(380, signal);
    p = Math.min(100, Math.round(p + Math.random() * 14 + 6));
    onProgress(p);
  }
}

async function uploadToApi(
  file: File,
  opts: SubmitUploadOpts,
): Promise<{
  audioId: string
  transcript: { text: string; language: string; meetingId?: string; transcriptId?: string }
}> {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

  if (!opts.meetingId) {
    return Promise.reject(new Error('נא לבחור פגישה מהיומן לפני ההעלאה'));
  }

  // Current API: POST /audio/upload saves + transcribes in one request and returns text.
  // Use XHR so we can report upload-byte progress (0–40%), then animate 40–99 while Whisper runs.
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', base + '/audio/upload');
    xhr.responseType = 'json';
    // XHR bypasses apiClient — attach Bearer when demo/login stored a token.
    const token = getApiAccessToken();
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

    let tick: number | null = null;
    let p = 0;

    const stopTick = () => {
      if (tick != null) {
        window.clearInterval(tick);
        tick = null;
      }
    };

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      p = Math.round((e.loaded / e.total) * 40);
      opts.onProgress(Math.max(0, Math.min(40, p)));
    };

    xhr.upload.onload = () => {
      p = Math.max(p, 40);
      opts.onProgress(p);
      tick = window.setInterval(() => {
        p = Math.min(95, p + 1);
        opts.onProgress(p);
      }, 400);
    };

    xhr.onload = () => {
      stopTick();
      if (xhr.status >= 200 && xhr.status < 300) {
        let body = xhr.response as any;
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch { body = null; }
        }
        if (!body && typeof xhr.responseText === 'string' && xhr.responseText) {
          try { body = JSON.parse(xhr.responseText); } catch { body = null; }
        }
        if (!body?.id || typeof body.text !== 'string') {
          reject(new Error('Invalid upload response'));
          return;
        }
        opts.onProgress(100);
        resolve({
          audioId: body.id,
          transcript: {
            text: body.text,
            language: body.language || 'he',
            meetingId: body.meeting_id || opts.meetingId,
            transcriptId: body.transcript_id || undefined,
          },
        });
      } else if (xhr.status === 409) {
        reject(new Error('לפגישה זו כבר יש תמלול'));
      } else if (xhr.status === 400) {
        reject(new Error('נא לבחור פגישה מהיומן לפני ההעלאה'));
      } else if (xhr.status === 404) {
        reject(new Error('הפגישה או המטופל לא נמצאו'));
      } else {
        reject(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = () => { stopTick(); reject(new Error('Network error')); };
    xhr.onabort = () => { stopTick(); reject(new DOMException('Aborted', 'AbortError')); };

    const form = new FormData();
    form.append('file', file);
    form.append('patient_id', opts.patientId);
    form.append('meeting_id', opts.meetingId);
    form.append('session_date', opts.sessionDate || todayKey());
    xhr.send(form);

    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
  });
}

export async function submitUpload(file: File, opts: SubmitUploadOpts): Promise<SubmitUploadResult> {
  if (!opts.online) {
    const queueId = await enqueueUpload({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      blob: file,
      patientId: opts.patientId,
      sessionDate: opts.sessionDate || todayKey(),
      meetingId: opts.meetingId,
    });
    return { status: 'queued', queueId };
  }

  if (isApiConfigured()) {
    const result = await uploadToApi(file, opts);
    return { status: 'success', audioId: result.audioId, transcript: result.transcript };
  }

  await simulateUploadProgress(opts.onProgress, opts.signal);
  return { status: 'success' };
}

export async function drainUploadQueue(opts: {
  online: boolean
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}): Promise<{
  synced: number
  last?: {
    patientId: string
    audioId?: string
    transcript?: { text: string; language: string; meetingId?: string; transcriptId?: string }
  }
}> {
  if (!opts.online) return { synced: 0 };
  const pending = await listPendingUploads();
  let synced = 0;
  let last: {
    patientId: string
    audioId?: string
    transcript?: { text: string; language: string; meetingId?: string; transcriptId?: string }
  } | undefined;
  for (const item of pending) {
    if (opts.signal?.aborted) break;
    const file = new File([item.blob], item.fileName, { type: item.mimeType });
    const uploadOpts: SubmitUploadOpts = {
      patientId: item.patientId,
      sessionDate: item.sessionDate,
      meetingId: item.meetingId,
      online: true,
      onProgress: (p) => opts.onProgress?.(p),
      signal: opts.signal,
    };
    if (isApiConfigured()) {
      const result = await uploadToApi(file, uploadOpts);
      last = { patientId: item.patientId, audioId: result.audioId, transcript: result.transcript };
    } else {
      await simulateUploadProgress(uploadOpts.onProgress, opts.signal);
      last = { patientId: item.patientId };
    }
    await removePendingUpload(item.id);
    synced++;
  }
  return { synced, last };
}

/** Lightweight ping — used before attempting API upload. */
export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
