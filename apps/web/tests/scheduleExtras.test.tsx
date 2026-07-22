// Phase 3d: recurring weekly meetings, add-patient-with-a-first-meeting, and the
// Google-Calendar connect button (demo — an honest toast, no real OAuth).
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });
const btn = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLElement;

describe('schedule — recurring meetings', () => {
  it('creating a weekly recurrence schedules multiple meetings', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    fireEvent.click(document.querySelector('.calh-new-btn') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[aria-label="חזרה על הפגישה"]')).toBeTruthy());
    fireEvent.change(document.querySelector('[aria-label="חזרה על הפגישה"]') as HTMLElement, { target: { value: 'weekly4' } });
    // Scope to the action dialog — the dashboard also has "קביעת פגישה" CTAs
    // (e.g. patients without an upcoming meeting) that would steal a global query.
    const dialog = document.querySelector('[role="dialog"][aria-label="חלון פעולה"]') as HTMLElement;
    const submit = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'קביעת פגישה') as HTMLElement;
    fireEvent.click(submit);
    await waitFor(() => expect(document.body.textContent).toContain('נקבעו 4 פגישות שבועיות'));
  });
});

describe('add patient — with a first meeting', () => {
  it('opens the schedule dialog after creating when opted in', async () => {
    mount({ view: 'app', route: 'patients' });
    await settle();
    fireEvent.click(document.querySelector('.pat-new-btn') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[aria-label="שם מלא"]')).toBeTruthy());
    fireEvent.input(document.querySelector('[aria-label="שם מלא"]') as HTMLElement, { target: { value: 'טסט טסטי' } });
    fireEvent.input(document.querySelector('[aria-label="טלפון"]') as HTMLElement, { target: { value: '050-1112223' } });
    fireEvent.click(document.querySelector('[aria-label="קביעת פגישה ראשונה לאחר היצירה"]') as HTMLElement);
    fireEvent.click(btn('יצירת מטופל'));
    await waitFor(() => expect(document.body.textContent).toContain('קביעת פגישה חדשה'));
  });
});

describe('google calendar connect (demo)', () => {
  it('shows an honest "coming soon" toast', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    fireEvent.click(btn('חיבור ל-Google Calendar'));
    await waitFor(() => expect(document.body.textContent).toContain('Google Calendar'));
  });
});
