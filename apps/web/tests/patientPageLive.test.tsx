// Patient page — live API mode must not show seeded overview / fake session history.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import type { CalendarUiEvent } from '../src/services/calendar';
import { EMPTY_OVERVIEW, patientOverviewBase, patientOverviewDefault } from '../src/data/patientOverview';

const {
  loadPatientUpcomingEvents,
  loadPatientPastEvents,
  isApiConfiguredMock,
  listPatients,
  fetchMeetingSummary,
} = vi.hoisted(() => ({
  loadPatientUpcomingEvents: vi.fn(async () => [] as CalendarUiEvent[]),
  loadPatientPastEvents: vi.fn(async () => [] as CalendarUiEvent[]),
  isApiConfiguredMock: vi.fn(() => false),
  listPatients: vi.fn(async () => [] as Array<{ id: string; name: string; phone: string; email: string | null; created_at: string; archived?: boolean }>),
  fetchMeetingSummary: vi.fn(async (): Promise<{ meeting_id: string; status: 'ready'; text: string | null }> => ({
    meeting_id: '',
    status: 'ready',
    text: null,
  })),
}));

vi.mock('../src/services/calendar', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/calendar')>();
  return { ...actual, loadPatientUpcomingEvents, loadPatientPastEvents };
});

vi.mock('../src/services/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/apiClient')>();
  return { ...actual, isApiConfigured: isApiConfiguredMock };
});

vi.mock('../src/services/patients', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/patients')>();
  return { ...actual, listPatients };
});

vi.mock('../src/services/meetingSummary', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/meetingSummary')>();
  return { ...actual, fetchMeetingSummary };
});

const PKEY = 'sensei_session_react_v1';
const LIVE_PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));

function pastUiEvent(patientId: string): CalendarUiEvent {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end.getTime() - 50 * 60_000);
  return {
    id: 'db-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    title: 'פגישה',
    description: '',
    location: '',
    htmlLink: '',
    meetLink: '',
    allDay: false,
    start,
    end,
    status: 'confirmed',
    attendees: [{ name: 'Live Patient', email: '', self: false, response: 'accepted' }],
    source: 'db',
    patientId,
  };
}

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
beforeEach(() => {
  isApiConfiguredMock.mockReturnValue(false);
  loadPatientUpcomingEvents.mockResolvedValue([]);
  loadPatientPastEvents.mockResolvedValue([]);
  fetchMeetingSummary.mockResolvedValue({ meeting_id: '', status: 'ready', text: '' });
  listPatients.mockResolvedValue([]);
});

describe('patientOverviewBase', () => {
  it('returns seeded Simba/default copy offline', () => {
    expect(patientOverviewBase('p5', false).summary).toContain('מופאסה');
    expect(patientOverviewBase('p1', false)).toEqual(patientOverviewDefault('p1'));
  });

  it('returns empty fields when the API is live', () => {
    expect(patientOverviewBase('p5', true)).toEqual(EMPTY_OVERVIEW);
    expect(patientOverviewBase('p1', true).summary).toBe('');
  });
});

describe('patient page — live API (no seeded clinical body)', () => {
  it('does not show Simba/default overview or fake session rows when calendar is empty', async () => {
    isApiConfiguredMock.mockReturnValue(true);
    loadPatientPastEvents.mockResolvedValue([]);
    const livePatient = {
      id: LIVE_PID,
      name: 'Live Patient',
      phone: '050-0000000',
      email: null as string | null,
      created_at: '2026-01-01T00:00:00Z',
      archived: false,
    };
    listPatients.mockResolvedValue([livePatient]);

    mount({
      view: 'app',
      route: 'patient',
      patientId: LIVE_PID,
      patients: [livePatient],
    });
    await settle();
    await act(() => new Promise((r) => setTimeout(r, 150)));

    await waitFor(() => expect(document.body.textContent).toContain('Live Patient'));
    expect(document.body.textContent).not.toContain('מופאסה');
    expect(document.body.textContent).not.toContain('מטופל בטיפול מתמשך');
    expect(document.body.textContent).not.toContain('מהפגישה הקודמת:');
    expect(document.querySelectorAll('.pd-sess-row').length).toBe(0);
    expect(document.body.textContent).toContain('אין פגישות קודמות');
    expect(loadPatientPastEvents).toHaveBeenCalled();
  });

  it('shows a past meeting from the API and opens summary with meetingId', async () => {
    isApiConfiguredMock.mockReturnValue(true);
    const event = pastUiEvent(LIVE_PID);
    loadPatientPastEvents.mockResolvedValue([event]);
    fetchMeetingSummary.mockResolvedValue({
      meeting_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      status: 'ready',
      text: 'סיכום אמיתי מהשרת על התקדמות בטיפול.',
    });
    const livePatient = {
      id: LIVE_PID,
      name: 'Live Patient',
      phone: '050-0000000',
      email: null as string | null,
      created_at: '2026-01-01T00:00:00Z',
      archived: false,
    };
    listPatients.mockResolvedValue([livePatient]);

    mount({
      view: 'app',
      route: 'patient',
      patientId: LIVE_PID,
      patients: [livePatient],
    });
    await settle();
    await waitFor(() => expect(document.querySelector('.pd-sess-row')).toBeTruthy());
    expect(document.body.textContent).toContain('סיכום אמיתי מהשרת');
    expect(document.body.textContent).toContain('מהפגישה הקודמת:');
    expect(document.body.textContent).not.toContain('מופאסה');
  });
});
