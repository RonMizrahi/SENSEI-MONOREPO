// Next-meeting report launcher — patient picker and generate flow.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { formatMeetingWhen } from '../src/components/patient/UpcomingMeetingList';
import { MOCK_PATIENTS } from '../src/data/mockPatients';
import type { CalendarUiEvent } from '../src/services/calendar';

const { loadPatientUpcomingEvents, isApiConfiguredMock, loadPatientsWithFallback } = vi.hoisted(() => ({
  loadPatientUpcomingEvents: vi.fn(async () => [] as CalendarUiEvent[]),
  isApiConfiguredMock: vi.fn(() => false),
  loadPatientsWithFallback: vi.fn(async (current: Array<{ id: string; name: string }>) => ({ patients: current })),
}));

vi.mock('../src/services/calendar', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/calendar')>();
  return { ...actual, loadPatientUpcomingEvents };
});

vi.mock('../src/services/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/apiClient')>();
  return { ...actual, isApiConfigured: isApiConfiguredMock };
});

vi.mock('../src/services/patients', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/patients')>();
  return { ...actual, loadPatientsWithFallback };
});

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));

function futureUiEvent(patientId = 'p1'): CalendarUiEvent {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  start.setHours(11, 0, 0, 0);
  const end = new Date(start.getTime() + 50 * 60_000);
  return {
    id: 'db-test-meeting',
    title: 'פגישה',
    description: '',
    location: '',
    htmlLink: '',
    meetLink: '',
    allDay: false,
    start,
    end,
    status: 'confirmed',
    attendees: [{ name: 'דנה לוי', email: '', self: false, response: 'accepted' }],
    source: 'db',
    patientId,
  };
}

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
beforeEach(() => {
  isApiConfiguredMock.mockReturnValue(false);
  loadPatientUpcomingEvents.mockResolvedValue([]);
  loadPatientsWithFallback.mockImplementation(async (current: Array<{ id: string; name: string }>) => ({
    patients: current.length ? current : MOCK_PATIENTS,
  }));
});

describe('next meeting report launcher', () => {
  it('shows patient selector and generate button in the sidebar route', async () => {
    mount({ view: 'app', route: 'nextMeetingReport' });
    await settle();
    expect(document.querySelector('#main-content h1')?.textContent).toContain('דוח לפגישה הבאה');
    expect(document.querySelector('#nmr-patient')).toBeTruthy();
    expect(document.querySelector('[aria-label="יצירת דוח הכנה"]')).toBeTruthy();
  });

  it('generates the prep report for the selected patient', async () => {
    mount({ view: 'app', route: 'nextMeetingReport', patientId: 'p1' });
    await settle();
    fireEvent.click(document.querySelector('[aria-label="יצירת דוח הכנה"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toContain('דוח הכנה לפגישה'));
  });

  it('shows the upcoming meeting from the API instead of the no-meeting fallback', async () => {
    const event = futureUiEvent('p1');
    (isApiConfiguredMock).mockReturnValue(true);
    loadPatientUpcomingEvents.mockResolvedValue([event]);

    mount({
      view: 'app',
      route: 'nextMeetingReport',
      patientId: 'p1',
      patients: MOCK_PATIENTS,
    });
    await settle();
    await act(() => new Promise((r) => setTimeout(r, 120)));

    const expected = formatMeetingWhen(new Date(event.start));
    await waitFor(() => {
      expect(document.body.textContent).toContain(expected);
    });
    expect(document.body.textContent).toContain('הפגישה הבאה');
    expect(document.body.textContent).not.toContain('תאריך היום');
    expect(document.body.textContent).not.toContain('אין פגישה מתוכננת · הדוח יתבסס על הפגישה האחרונה');
    expect(loadPatientUpcomingEvents).toHaveBeenCalled();
  });
});
