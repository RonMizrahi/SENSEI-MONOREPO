// In-browser audio capture via MediaRecorder + getUserMedia.
// When mock=true (no API), simulates recording with a demo MP3 — same pipeline as file upload mock.
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildMockRecordingFile } from '../services/upload';

export type RecorderStatus = 'idle' | 'recording' | 'error';

export interface UseAudioRecorderOptions {
  mock?: boolean;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function normalizeMimeType(type: string): string {
  return type.split(';')[0].trim() || type;
}

function extForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'm4a';
  return 'webm';
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const mock = options.mock ?? false;
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeType = useRef('');
  const mockActive = useRef(false);

  const cleanupStream = useCallback(() => {
    if (stream.current) {
      stream.current.getTracks().forEach((t) => t.stop());
      stream.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    recorder.current = null;
    chunks.current = [];
    mockActive.current = false;
    cleanupStream();
    setElapsed(0);
    setPaused(false);
    setError('');
    setStatus('idle');
  }, [cleanupStream]);

  useEffect(() => () => reset(), [reset]);

  const supported = mock || (typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined');

  const start = useCallback(async () => {
    if (!supported) {
      setError('הדפדפן שלכם לא תומך בהקלטת אודיו.');
      setStatus('error');
      return;
    }
    setError('');
    setPaused(false);
    if (mock) {
      mockActive.current = true;
      setElapsed(0);
      setStatus('recording');
      timer.current = setInterval(() => setElapsed((n) => n + 1), 1000);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      mimeType.current = pickMimeType();
      const rec = mimeType.current
        ? new MediaRecorder(media, { mimeType: mimeType.current })
        : new MediaRecorder(media);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onerror = () => {
        setError('שגיאה במהלך ההקלטה.');
        setStatus('error');
      };
      rec.start(1000);
      recorder.current = rec;
      setElapsed(0);
      setStatus('recording');
      timer.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    } catch (e: any) {
      cleanupStream();
      const denied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
      setError(denied
        ? 'נדרשת הרשאת מיקרופון. אפשרו גישה בהגדרות הדפדפן.'
        : 'לא ניתן להפעיל את המיקרופון.');
      setStatus('error');
    }
  }, [supported, mock, cleanupStream]);

  const stop = useCallback((): Promise<File | null> => {
    if (mock && mockActive.current) {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      mockActive.current = false;
      const file = buildMockRecordingFile();
      reset();
      return Promise.resolve(file);
    }
    return new Promise((resolve) => {
      const rec = recorder.current;
      if (!rec || rec.state === 'inactive') { reset(); resolve(null); return; }
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      rec.onstop = () => {
        const rawType = mimeType.current || rec.mimeType || 'audio/webm';
        const type = normalizeMimeType(rawType);
        const blob = new Blob(chunks.current, { type });
        const ext = extForMime(type);
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const file = new File([blob], 'recording-' + ts + '.' + ext, { type });
        reset();
        resolve(file);
      };
      rec.stop();
    });
  }, [mock, reset]);

  // Pause/resume — freezes the elapsed timer (and the real MediaRecorder when
  // present); status stays 'recording' throughout. Used by the mobile recorder.
  const pause = useCallback(() => {
    if (status !== 'recording' || paused) return;
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (!mock && recorder.current && recorder.current.state === 'recording') {
      try { recorder.current.pause(); } catch { /* ignore */ }
    }
    setPaused(true);
  }, [status, paused, mock]);

  const resume = useCallback(() => {
    if (status !== 'recording' || !paused) return;
    if (!mock && recorder.current && recorder.current.state === 'paused') {
      try { recorder.current.resume(); } catch { /* ignore */ }
    }
    timer.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    setPaused(false);
  }, [status, paused, mock]);

  const cancel = useCallback(() => {
    if (mock && mockActive.current) {
      reset();
      return;
    }
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = () => reset();
      rec.stop();
    } else {
      reset();
    }
  }, [mock, reset]);

  return { status, elapsed, paused, error, supported, mock, start, stop, cancel, reset, pause, resume };
}
