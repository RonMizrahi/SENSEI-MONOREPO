import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { dayKey } from '../src/services/calendar';

// Isolate from the offline calendar fixture: it seeds events for mock patients
// (e.g. "דנה לוי" = p1), whose count depends on the current date and would
// otherwise inflate the upcoming list. Stub only the remote/fixture load so the
// list is driven purely by the test's scheduledAppts; all other calendar logic
// (localApptsToUiEvents, eventMatchesPatient, ...) stays real.
vi.mock('../src/services/calendar', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/calendar')>();
  return { ...actual, loadPatientUpcomingEvents: vi.fn(async () => []) };
});

const PKEY = 'sensei_session_react_v1';

function futureAppts(count: number) {
  const base = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(9, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return {
      id: 'sched-test-' + i,
      pid: 'p1',
      date: dayKey(d),
      time: '10:00',
      dur: 50,
      description: 'פגישה ' + (i + 1),
    };
  });
}

function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('patient upcoming meetings', () => {
  it('shows up to 5 upcoming meetings on the patient page with a link to the full list', async () => {
    const scheduledAppts = futureAppts(7);
    mount({ view: 'app', route: 'patient', patientId: 'p1', scheduledAppts });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('פגישות קרובות'));
    await waitFor(() => expect(document.querySelectorAll('.pd-upcoming-row').length).toBe(5));
    expect(document.body.textContent).toContain('כל הפגישות הקרובות');
    fireEvent.click(document.querySelector('.pd-upcoming-link') as HTMLElement);
    await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toContain('פגישות קרובות'));
    await act(() => new Promise((r) => setTimeout(r, 350)));
    await waitFor(() => expect(document.querySelectorAll('.pd-upcoming-row').length).toBe(7));
  });

  it('opens the full upcoming meetings page directly with all meetings', async () => {
    mount({ view: 'app', route: 'upcomingMeetings', patientId: 'p1', scheduledAppts: futureAppts(8) });
    await settle();
    await act(() => new Promise((r) => setTimeout(r, 350)));
    await waitFor(() => expect(document.querySelectorAll('.pd-upcoming-row').length).toBe(8));
    expect(document.body.textContent).toContain('8 פגישות');
  });

  it('deletes a scheduled meeting from the upcoming list', async () => {
    mount({ view: 'app', route: 'upcomingMeetings', patientId: 'p1', scheduledAppts: futureAppts(3) });
    await settle();
    await act(() => new Promise((r) => setTimeout(r, 350)));
    await waitFor(() => expect(document.querySelectorAll('.pd-upcoming-row').length).toBe(3));
    fireEvent.click(document.querySelector('[aria-label="מחיקת פגישה"]') as HTMLElement);
    await waitFor(() => expect(document.body.textContent).toContain('מחיקת פגישה מתוכננת'));
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'מחיקת הפגישה') as HTMLElement);
    await waitFor(() => expect(document.querySelectorAll('.pd-upcoming-row').length).toBe(2));
  });
});
