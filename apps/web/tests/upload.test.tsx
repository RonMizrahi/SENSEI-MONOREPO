// Audio upload flow — the recording-upload drop zone: an unsupported file is rejected
// with the format error, and a supported file is accepted and moves into the processing
// pipeline. Drives the real store state machine (S.upload) via a drop event; no network,
// no timers advanced (asserts the immediate state transition, not the simulated progress).
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { clearMemoryUploadQueue } from '../src/services/uploadQueue';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); clearMemoryUploadQueue(); });

// the drop zone is the only dashed-border element on the upload screen
const dropzone = () => document.querySelector('[style*="dashed"]') as HTMLElement;
const drop = (name: string) =>
  fireEvent.drop(dropzone(), { dataTransfer: { files: [new File(['x'], name, { type: 'audio/mpeg' })] } });

async function openUpload() {
  mount({ view: 'app', route: 'upload' });
  await settle();
  await waitFor(() => expect(dropzone()).toBeTruthy());
}

describe('audio upload — validation & state transitions', () => {
  it('rejects an unsupported file format with a clear error message', async () => {
    await openUpload();
    drop('meeting-video.mp4');
    await waitFor(() => expect(document.body.textContent).toContain('אינו נתמך')); // "…file type is not supported…"
    // stays out of the processing pipeline (no crash, actionable error)
    expect(document.body.textContent).toMatch(/MP3|WAV|M4A/);
  });

  it('accepts a supported file and leaves the idle drop zone for the processing pipeline', async () => {
    await openUpload();
    expect(dropzone(), 'idle drop zone shown before upload').toBeTruthy();
    drop('session-2026-06-22.mp3');
    // valid → state machine advances past idle: the dashed drop zone is replaced by the
    // uploading/processing UI (deterministic transition; progress timer not awaited)
    await waitFor(() => expect(document.querySelector('[style*="dashed"]')).toBeFalsy());
  });

  it('finishing a real upload sets the persisted hasUploaded flag', async () => {
    await openUpload();
    drop('session.mp3');
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(PKEY) || '{}');
      expect(stored.hasUploaded).toBe(true);
    }, { timeout: 10000 });
  }, 15000);

  it('the processing UI exposes an accessible progressbar and a working cancel (back to idle)', async () => {
    await openUpload();
    drop('session-2026-06-22.mp3');
    // accessible progress reporting (WCAG 4.1.2): role + live value
    await waitFor(() => expect(document.querySelector('[role="progressbar"]')).toBeTruthy());
    const bar = document.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toMatch(/^\d+$/);
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    // the user is never locked into the simulated pipeline — cancel aborts to idle
    fireEvent.click(document.querySelector('[aria-label="ביטול ההעלאה"]') as HTMLElement);
    await waitFor(() => expect(dropzone(), 'back to the idle drop zone').toBeTruthy());
    // and the progress interval is dead: state stays idle instead of re-entering uploading
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(document.querySelector('[role="progressbar"]')).toBeFalsy();
  });

  it('queues a file when offline and shows the saved-for-later state', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    mount({ view: 'app', route: 'upload' });
    await settle();
    drop('session-offline.webm');
    await waitFor(() => expect(document.body.textContent).toContain('נשמרה להעלאה מאוחרת'));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('offers both file upload and in-browser recording tabs', async () => {
    // The upload screen exposes two capture modes: file upload (default) and
    // direct in-browser recording.
    mount({ view: 'app', route: 'upload' });
    await settle();
    await waitFor(() => expect(document.querySelector('[style*="dashed"]')).toBeTruthy());
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'הקלטה ישירה'), 'record tab present').toBe(true);
    // the file-upload affordance is present (default mode)
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('בחירת קובץ'))).toBe(true);
  });
});

describe('meeting date field — date-only contract', () => {
  it('every meeting-date option is DD/MM/YY with no time component', async () => {
    await openUpload();
    const select = document.querySelector('select[aria-label="בחירת תאריך פגישה"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const labels = [...select.options].map((o) => o.textContent!.trim()).filter((t) => t && !/אין פגישות/.test(t));
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label, 'date-only DD/MM/YY').toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
      expect(label).not.toMatch(/\d{1,2}:\d{2}/); // no HH:MM anywhere
    }
  });
});
