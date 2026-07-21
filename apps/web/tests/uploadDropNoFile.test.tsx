// A drop that carries no real file (e.g. text/a link dragged from another app)
// must NOT silently fabricate and upload a phantom recording. The synthetic
// sample file is a demo-only affordance, gated behind offline demoMode; a normal
// build (or demo login with the API connected) stays on the idle drop zone /
// opens the OS picker instead of starting a bogus upload.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { clearMemoryUploadQueue } from '../src/services/uploadQueue';

const { isApiConfiguredMock } = vi.hoisted(() => ({
  isApiConfiguredMock: vi.fn(() => false),
}));

vi.mock('../src/services/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/apiClient')>();
  return { ...actual, isApiConfigured: isApiConfiguredMock };
});

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); clearMemoryUploadQueue(); });
beforeEach(() => { isApiConfiguredMock.mockReturnValue(false); });

const dropzone = () => document.querySelector('[style*="dashed"]') as HTMLElement;
const dropNoFile = () => fireEvent.drop(dropzone(), { dataTransfer: { files: [] } });

describe('upload drop zone — no-file drop', () => {
  it('does not upload a phantom file when demo mode is off (stays idle)', async () => {
    mount({ view: 'app', route: 'upload', demoMode: false });
    await settle();
    await waitFor(() => expect(dropzone()).toBeTruthy());
    dropNoFile();
    // give any accidental upload a chance to advance the state machine
    await act(() => new Promise((r) => setTimeout(r, 120)));
    // still the idle drop zone — no processing UI, no phantom "פגישה_22-06.mp3"
    expect(dropzone(), 'idle drop zone preserved').toBeTruthy();
    expect(document.querySelector('[role="progressbar"]')).toBeFalsy();
  });

  it('keeps the demo affordance: a no-file drop in demo mode still explores the flow', async () => {
    mount({ view: 'app', route: 'upload', demoMode: true });
    await settle();
    await waitFor(() => expect(dropzone()).toBeTruthy());
    dropNoFile();
    await waitFor(() => expect(document.querySelector('[style*="dashed"]')).toBeFalsy());
  });

  it('demo mode: "בחירת קובץ" runs the sample flow instead of the OS file picker (journey unblocker)', async () => {
    // The core demo journey (upload → AI outputs) was blocked: the pick button
    // always opened a native OS picker, demanding a real audio file demo users
    // don't have. In offline demo mode it must fabricate the sample recording
    // (same as the demo drop path) so the flow completes.
    mount({ view: 'app', route: 'upload', demoMode: true });
    await settle();
    const pick = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('בחירת קובץ')) as HTMLElement;
    expect(pick).toBeTruthy();
    fireEvent.click(pick);
    // the flow leaves the idle drop zone and eventually lands on the transcript
    await waitFor(() => expect(document.querySelector('[style*="dashed"]')).toBeFalsy());
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/transcript/), { timeout: 5000 });
  });

  it('normal mode: "בחירת קובץ" does NOT fabricate a sample (opens the real picker)', async () => {
    mount({ view: 'app', route: 'upload', demoMode: false });
    await settle();
    const pick = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('בחירת קובץ')) as HTMLElement;
    fireEvent.click(pick);
    await act(() => new Promise((r) => setTimeout(r, 150)));
    expect(dropzone(), 'stays idle — no phantom upload in a real build').toBeTruthy();
  });

  it('demoMode + API configured: "בחירת קובץ" opens the real picker (no phantom sample)', async () => {
    // enterDemo keeps demoMode=true while talking to the live API — fabricating
    // a sample would skip the OS picker and could POST junk audio.
    isApiConfiguredMock.mockReturnValue(true);
    const createEl = vi.spyOn(document, 'createElement');
    mount({ view: 'app', route: 'upload', demoMode: true });
    await settle();
    const pick = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('בחירת קובץ')) as HTMLElement;
    expect(pick).toBeTruthy();
    fireEvent.click(pick);
    await act(() => new Promise((r) => setTimeout(r, 150)));
    expect(dropzone(), 'stays idle — native picker path, no phantom upload').toBeTruthy();
    expect(
      createEl.mock.calls.some(([tag]) => tag === 'input'),
      'creates a file input for the OS picker',
    ).toBe(true);
    createEl.mockRestore();
  });
});
