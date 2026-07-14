// Calendar service — mock fixture always loads; DB events merge when API is configured.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE = 'http://localhost:8000';

function loadCalendarModule(baseUrl: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', baseUrl);
  return import('../src/services/calendar');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('calendar service — normalization & merge', () => {
  it('normalizeDbEvents maps API rows into the calendar UI shape', async () => {
    const cal = await loadCalendarModule('');
    const events = cal.normalizeDbEvents([
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'פגישה מהמערכת',
        description: 'הערות',
        start_at: '2026-06-25T10:00:00+03:00',
        end_at: '2026-06-25T11:00:00+03:00',
        created_at: '2026-06-24T12:00:00+03:00',
        therapist_id: '11111111-1111-1111-1111-111111111111',
        patient_id: 'p3',
      },
    ], (id) => (id === 'p3' ? 'מיכל כהן' : undefined));

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('db-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(events[0].title).toBe('פגישה מהמערכת');
    expect(events[0].source).toBe('db');
    expect(events[0].attendees[0]?.name).toBe('מיכל כהן');
  });

  it('mergeCalendarEvents keeps fixture rows and adds non-colliding DB rows', async () => {
    const cal = await loadCalendarModule('');
    const start = new Date('2026-06-25T10:00:00+03:00');
    const end = new Date('2026-06-25T11:00:00+03:00');
    const fixture = [{
      id: 'evt-901',
      title: 'mock',
      description: '',
      location: '',
      htmlLink: '',
      meetLink: '',
      allDay: false,
      start,
      end,
      status: 'confirmed',
      attendees: [],
      source: 'fixture' as const,
    }];
    const db = [{
      ...fixture[0],
      id: 'db-123',
      title: 'db meeting',
      source: 'db' as const,
    }];
    const merged = cal.mergeCalendarEvents(fixture, db);
    expect(merged.map((e) => e.id)).toEqual(['evt-901', 'db-123']);
  });

  it('eventMatchesPatient matches title by name case-insensitively', async () => {
    const cal = await loadCalendarModule('');
    const event = {
      id: 'x',
      title: 'פגישה שבועית · test test test',
      description: '',
      location: '',
      htmlLink: '',
      meetLink: '',
      allDay: false,
      start: new Date('2026-07-15T11:00:00+03:00'),
      end: new Date('2026-07-15T11:50:00+03:00'),
      status: 'confirmed',
      attendees: [],
      source: 'db' as const,
      patientId: null,
    };
    expect(cal.eventMatchesPatient(event, 'p-local', 'Test Test Test')).toBe(true);
  });

  it('localApptsToUiEvents shows future scheduled appointments immediately', async () => {
    const cal = await loadCalendarModule('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.getFullYear() + '-'
      + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-'
      + String(tomorrow.getDate()).padStart(2, '0');
    const events = cal.localApptsToUiEvents(
      [{ id: 'sched-1', pid: 'p1', date, time: '14:00', dur: 50 }],
      'p1',
      'דנה לוי',
    );
    expect(events).toHaveLength(1);
    expect(cal.isUpcomingEvent(events[0])).toBe(true);
  });

  it('mergeCalendarEventsUnique collapses local and API rows for the same slot', async () => {
    const cal = await loadCalendarModule('');
    const start = new Date('2026-07-16T11:00:00+03:00');
    const end = new Date('2026-07-16T11:50:00+03:00');
    const local = [{
      id: 'sched-1',
      title: 'דנה לוי',
      description: '',
      location: '',
      htmlLink: '',
      meetLink: '',
      allDay: false,
      start,
      end,
      status: 'confirmed',
      attendees: [],
      source: 'db' as const,
      patientId: 'p1',
    }];
    const remote = [{
      ...local[0],
      id: 'db-abc',
      source: 'db' as const,
    }];
    const merged = cal.mergeCalendarEventsUnique(remote, local);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('db-abc');
  });
});

describe('calendar service — loadCalendarEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns only the fixture when the API is not configured', async () => {
    const cal = await loadCalendarModule('');
    const now = new Date('2026-06-22T12:00:00+03:00');
    const promise = cal.loadCalendarEvents({ timeMin: cal.weekStart(now), timeMax: cal.weekEnd(now) });
    await vi.advanceTimersByTimeAsync(700);
    const events = await promise;
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.source === 'fixture')).toBe(true);
  });

  it('loads DB events from /calendar when the API is configured', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/calendar')) {
        return new Response(JSON.stringify([
          {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            title: 'פגישה מה-DB',
            description: null,
            start_at: '2026-06-22T14:00:00+03:00',
            end_at: '2026-06-22T15:00:00+03:00',
            created_at: '2026-06-21T12:00:00+03:00',
            therapist_id: '11111111-1111-1111-1111-111111111111',
            patient_id: null,
          },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const cal = await loadCalendarModule(BASE);
    const now = new Date('2026-06-22T12:00:00+03:00');
    const promise = cal.loadCalendarEvents({ timeMin: cal.weekStart(now), timeMax: cal.weekEnd(now), weekAnchor: now });
    await vi.advanceTimersByTimeAsync(700);
    const events = await promise;

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/calendar'))).toBe(true);
    expect(events.every((e) => e.source === 'db')).toBe(true);
    expect(events.some((e) => e.title === 'פגישה מה-DB')).toBe(true);
  });

  it('returns an empty list when the API fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const cal = await loadCalendarModule(BASE);
    const now = new Date('2026-06-22T12:00:00+03:00');
    const promise = cal.loadCalendarEvents({ timeMin: cal.weekStart(now), timeMax: cal.weekEnd(now), weekAnchor: now });
    await vi.advanceTimersByTimeAsync(700);
    const events = await promise;
    expect(events).toEqual([]);
  });

  it('createCalendarEvent POSTs to /calendar', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/calendar') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          title: 'דנה לוי',
          description: null,
          start_at: '2026-06-22T11:00:00+03:00',
          end_at: '2026-06-22T11:50:00+03:00',
          created_at: '2026-06-22T10:00:00+03:00',
          therapist_id: '11111111-1111-1111-1111-111111111111',
          patient_id: null,
        }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const cal = await loadCalendarModule(BASE);
    const times = cal.buildAppointmentTimes('11:00', 50, '2026-06-22');
    const created = await cal.createCalendarEvent({
      title: 'דנה לוי',
      ...times,
    });

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/calendar') && c[1]?.method === 'POST')).toBe(true);
    expect(created.title).toBe('דנה לוי');
  });

  it('scheduledApptToUiEvent and eventMatchesPatient link local appts to a patient', async () => {
    const cal = await loadCalendarModule('');
    const event = cal.scheduledApptToUiEvent(
      { id: 'sched-1', pid: 'p1', date: '2026-06-28', time: '14:00', dur: 50, description: 'מעקב' },
      'דנה לוי',
    );
    expect(event.id).toBe('sched-1');
    expect(cal.eventMatchesPatient(event, 'p1', 'דנה לוי')).toBe(true);
    expect(+event.end).toBeGreaterThan(+event.start);
  });
});
