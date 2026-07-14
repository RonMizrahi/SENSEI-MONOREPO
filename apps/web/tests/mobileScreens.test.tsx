// Mobile prep-report, patient profile, and recording overlay — the bespoke
// mobile screens rendered by MobileApp for the report / patient routes. Same
// matchMedia mobile gating as mobileDayView.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { MOBILE_QUERY } from '../src/hooks/useIsMobile';

const PKEY = 'sensei_session_react_v1';

function setMobile() {
  window.matchMedia = ((q: string) => ({
    matches: q === MOBILE_QUERY,
    media: q,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as any;
}
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}

beforeEach(() => setMobile());
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('mobile prep report', () => {
  it('renders the prep sections and toggles a goal', async () => {
    const { container } = mount({ route: 'report', patientId: 'p3' });
    await waitFor(() => expect(container.querySelector('.mob-screen')).toBeTruthy());
    expect(container.textContent).toContain('סיכום הפגישה הקודמת');
    expect(container.textContent).toContain('נקודות למעקב');
    expect(container.textContent).toContain('מטרות לפגישה הקרובה');

    const goal = container.querySelector('.mob-goal') as HTMLElement;
    expect(goal.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(goal);
    await waitFor(() => expect(goal.getAttribute('aria-pressed')).toBe('true'));
    expect(container.querySelector('.mob-check.is-done')).toBeTruthy();
  });

  it('starts a recording from the prep report and stops it with a toast', async () => {
    const { container } = mount({ route: 'report', patientId: 'p3' });
    await waitFor(() => expect(container.querySelector('.mob-screen')).toBeTruthy());
    fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent === 'התחל הקלטה') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[role="dialog"][aria-label^="הקלטת פגישה"]')).toBeTruthy());
    // pause → resume toggles the control's accessible name (recorder pause/resume)
    const pauseBtn = () => [...document.querySelectorAll('button')]
      .find((b) => /השהיית הקלטה|המשך הקלטה/.test(b.getAttribute('aria-label') || '')) as HTMLElement;
    expect(pauseBtn().getAttribute('aria-label')).toBe('השהיית הקלטה');
    act(() => { fireEvent.click(pauseBtn()); });
    await waitFor(() => expect(pauseBtn().getAttribute('aria-label')).toBe('המשך הקלטה'));
    act(() => { fireEvent.click(pauseBtn()); });
    await waitFor(() => expect(pauseBtn().getAttribute('aria-label')).toBe('השהיית הקלטה'));
    // stop → overlay closes + processing toast
    act(() => { fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'סיום') as HTMLElement); });
    await waitFor(() => expect(document.querySelector('[role="dialog"][aria-label^="הקלטת פגישה"]')).toBeFalsy());
    await waitFor(() => expect(document.body.textContent).toContain('ההקלטה נשמרה'));
  });
});

describe('mobile patient profile', () => {
  it('renders the patient header, next meeting, and recent sessions', async () => {
    const { container } = mount({ route: 'patient', patientId: 'p1' });
    await waitFor(() => expect(container.querySelector('.mob-screen')).toBeTruthy());
    expect(container.textContent).toContain('תיק מטופל');
    expect(container.textContent).toContain('הפגישה הבאה');
    expect(container.textContent).toContain('פגישות אחרונות');
    expect(container.querySelectorAll('.mob-sess-row').length).toBeGreaterThan(0);
  });
});
