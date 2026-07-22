import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { demoSessionCount } from '../src/utils/patientSessions';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('patient meeting history', () => {
  it('the sidebar entry opens the all-patients DIRECTORY even when a patient is selected (spec screen 4)', async () => {
    // Regression: the sidebar used to preserve the selected patient, which made
    // the directory (initial view per the spec) unreachable after any patient
    // interaction. Per-patient history stays reachable from the patient file.
    mount({ view: 'app', route: 'patient', patientId: 'p5' });
    await settle();
    const nav = [...document.querySelectorAll('.app-sidebar a')].find((a) => a.textContent?.trim() === 'היסטוריית פגישות') as HTMLElement;
    expect(nav, 'sidebar entry exists').toBeTruthy();
    fireEvent.click(nav);
    await settle();
    // directory mode: all patients listed with a search field, not one patient's sessions
    await waitFor(() => expect(document.querySelector('#main-content input'), 'directory search field').toBeTruthy());
    expect(document.body.textContent).toContain('דנה לוי');
    expect(document.body.textContent).toContain('סימבה');
  });

  it('shows up to 5 recent sessions on the patient page with a link to the full history', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('היסטוריית פגישות'));
    const total = demoSessionCount({ id: 'p1' });
    expect(document.querySelectorAll('.pd-sess-row').length).toBeLessThanOrEqual(5);
    if (total > 5) {
      expect(document.body.textContent).toContain('כל ההיסטוריה');
      fireEvent.click(document.querySelector('.pd-history-link') as HTMLElement);
      await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toContain('היסטוריית פגישות'));
      await act(() => new Promise((r) => setTimeout(r, 350)));
      await waitFor(() => expect(document.querySelectorAll('.pd-sess-row').length).toBe(total));
    }
  });

  it('opens session detail when clicking a meeting in history', async () => {
    mount({ view: 'app', route: 'meetingHistory', patientId: 'p1' });
    await settle();
    await act(() => new Promise((r) => setTimeout(r, 350)));
    await waitFor(() => expect(document.querySelector('.pd-sess-row')).toBeTruthy());
    fireEvent.click(document.querySelector('.pd-sess-row button[aria-label^="פגישה"]') as HTMLElement);
    await act(() => new Promise((r) => setTimeout(r, 350)));
    await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toMatch(/פגישה/));
    expect(document.body.textContent).toContain('תובנות מרכזיות');
    expect(document.body.textContent).toContain('סיכום הפגישה');
    // the full AI summary now lives here (no separate inner screen, no transcript)
    expect(document.body.textContent).toContain('נושאים מרכזיים');
    expect(document.body.textContent).toContain('דגלי סיכון');
    expect(document.body.textContent).not.toContain('תמלול');
  });
});
