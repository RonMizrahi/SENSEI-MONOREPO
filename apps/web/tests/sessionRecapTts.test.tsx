// Spec 1.2 — "השמעה למפגש זה": per-session recap playback from the home agenda,
// so the therapist can hear one patient's "previously on" without opening the
// file. Client-side Web Speech (no backend). The control appears only when the
// API is supported; pressing it speaks the patient name + the previous-session
// summary; pressing again stops; it is independent of the daily-recap button.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import * as calendar from '../src/services/calendar';
import * as mockPatients from '../src/data/mockPatients';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 150)));
afterEach(() => {
  cleanup(); localStorage.clear(); window.location.hash = '';
  delete (window as any).speechSynthesis;
  delete (window as any).SpeechSynthesisUtterance;
  vi.restoreAllMocks();
});
const pad = (n: number) => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

function stubSpeech() {
  const spoken: string[] = [];
  (window as any).speechSynthesis = { speak: vi.fn((u: any) => spoken.push(u.text)), cancel: vi.fn() };
  (window as any).SpeechSynthesisUtterance = class {
    lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public text: string) {}
  };
  return { spoken, synth: (window as any).speechSynthesis };
}

// An agenda appointment for today at 23:59 (still "upcoming" whenever the test runs).
const todayAppt = { id: 'tts1', pid: 'p1', date: todayKey(), time: '23:59', dur: 50, description: '', status: 'upcoming' };
const playBtn = () => document.querySelector('[aria-label="השמעת תקציר למפגש · דנה לוי"]') as HTMLElement;

describe('home agenda — per-session recap TTS (spec 1.2)', () => {
  it('speaks the patient name and previous-session summary, and stops on second press', async () => {
    const { spoken, synth } = stubSpeech();
    vi.spyOn(calendar, 'loadCalendarEvents').mockResolvedValue([]);
    vi.spyOn(mockPatients, 'reconcileMockAppts').mockImplementation((appts: any[]) => appts || []);
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [todayAppt] });
    await settle();
    await waitFor(() => expect(playBtn(), 'a play control renders on the agenda row').toBeTruthy());

    fireEvent.click(playBtn());
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0]).toContain('דנה לוי');
    expect(spoken[0]).toContain('מהפגישה הקודמת');

    // while playing the same control becomes a stop toggle
    const stop = document.querySelector('[aria-label^="עצירת ההשמעה"]') as HTMLElement;
    expect(stop, 'the control flips to stop while playing').toBeTruthy();
    expect(stop.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(stop);
    expect(synth.cancel).toHaveBeenCalled();
    await waitFor(() => expect(playBtn(), 'back to play after stopping').toBeTruthy());
  });

  it('hides the control when the Web Speech API is absent', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [todayAppt] });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הפגישות שלך היום'));
    expect(playBtn(), 'no dead button without TTS support').toBeFalsy();
  });
});
