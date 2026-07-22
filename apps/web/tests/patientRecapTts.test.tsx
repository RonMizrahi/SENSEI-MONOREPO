// Spec 3.3 — "TTS Patient Recap": from the patient file, hear that patient's
// previous-session summary ahead of the upcoming meeting, without drilling in.
// Browser-native Web Speech (no backend); the control is hidden when the API is
// absent, and flips to a labelled stop toggle while playing.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

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
});

function stubSpeech() {
  const spoken: string[] = [];
  (window as any).speechSynthesis = { speak: vi.fn((u: any) => spoken.push(u.text)), cancel: vi.fn() };
  (window as any).SpeechSynthesisUtterance = class {
    lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public text: string) {}
  };
  return { spoken, synth: (window as any).speechSynthesis };
}
const playBtn = () => document.querySelector('[aria-label="השמעת תקציר הפגישה הקודמת"]') as HTMLElement;

describe('patient file — TTS patient recap (spec 3.3)', () => {
  it('speaks the patient name and previous-session summary, and stops on second press', async () => {
    const { spoken, synth } = stubSpeech();
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(playBtn(), 'a recap play control renders in the patient file').toBeTruthy());

    fireEvent.click(playBtn());
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0]).toContain('דנה לוי');
    expect(spoken[0]).toContain('מהפגישה הקודמת');

    const stop = document.querySelector('[aria-label="עצירת ההשמעה"]') as HTMLElement;
    expect(stop, 'flips to a stop toggle while playing').toBeTruthy();
    expect(stop.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(stop);
    expect(synth.cancel).toHaveBeenCalled();
    await waitFor(() => expect(playBtn()).toBeTruthy());
  });

  it('hides the control when the Web Speech API is absent', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('סקירת מטופל'));
    expect(playBtn(), 'no dead button without TTS support').toBeFalsy();
  });
});
