// Calendar service — mock Google-style fixture + optional senseiapi `/calendar` merge.
import { apiRequest, isApiConfigured } from './apiClient';

export const CALENDAR_TIME_ZONE = 'Asia/Jerusalem';

export interface CalendarUiEvent {
  id: string
  title: string
  description: string
  location: string
  htmlLink: string
  meetLink: string
  allDay: boolean
  start: Date
  end: Date
  status: string
  attendees: Array<{ name: string; email: string; self: boolean; response: string }>
  source: 'fixture' | 'db'
  patientId?: string | null
}

export interface DbCalendarEvent {
  id: string
  title: string
  description?: string | null
  start_at: string
  end_at: string
  created_at: string
  therapist_id: string
  patient_id?: string | null
}

export const dayKey = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export const weekStart = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
};

export const weekEnd = (d: Date) => {
  const e = weekStart(d);
  e.setDate(e.getDate() + 7);
  return e;
};

export const weekLastDay = (d: Date) => {
  const last = weekStart(d);
  last.setDate(last.getDate() + 6);
  return last;
};

export function normalizeGoogleEvents(items: any[]): CalendarUiEvent[] {
  return (items || [])
    .filter((e) => e && e.status !== 'cancelled' && e.start)
    .map((e) => {
      const allDay = !!(e.start.date && !e.start.dateTime);
      const start = new Date(e.start.dateTime || e.start.date);
      const end = new Date((e.end && (e.end.dateTime || e.end.date)) || (e.start.dateTime || e.start.date));
      let meet = e.hangoutLink || '';
      if (!meet && e.conferenceData && e.conferenceData.entryPoints) {
        const vp = e.conferenceData.entryPoints.find((p: any) => p.entryPointType === 'video');
        if (vp) meet = vp.uri;
      }
      return {
        id: e.id,
        title: e.summary || '(ללא כותרת)',
        description: e.description || '',
        location: e.location || '',
        htmlLink: e.htmlLink || '',
        meetLink: meet,
        allDay,
        start,
        end,
        status: e.status || 'confirmed',
        attendees: (e.attendees || []).map((a: any) => ({
          name: a.displayName || a.email || '',
          email: a.email || '',
          self: !!a.self,
          response: a.responseStatus || 'needsAction',
        })),
        source: 'fixture' as const,
      };
    })
    .sort((a, b) => +a.start - +b.start);
}

export function buildCalFixtureItems(weekAnchor = new Date()) {
  const base = weekStart(weekAnchor);
  const iso = (off: number, h: number, m: number) => {
    const d = new Date(base);
    d.setDate(base.getDate() + off);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const dayStr = (off: number) => {
    const d = new Date(base);
    d.setDate(base.getDate() + off);
    return dayKey(d);
  };
  const ev = (id: string, off: number, sh: number, sm: number, eh: number, em: number, summary: string, extra?: any) =>
    Object.assign({
      id,
      status: 'confirmed',
      summary,
      start: { dateTime: iso(off, sh, sm) },
      end: { dateTime: iso(off, eh, em) },
      htmlLink: 'https://calendar.google.com/calendar/r/eventedit/' + id,
    }, extra || {});
  const me = { email: 'rotem@clinic.co.il', self: true, responseStatus: 'accepted' };
  const g = (name: string, email: string, rs?: string) => ({ displayName: name, email, responseStatus: rs || 'accepted' });
  const items = [
    ev('evt-901', 0, 9, 0, 9, 50, 'פגישה שבועית · דנה לוי', { location: 'קליניקה · חדר 2', attendees: [g('דנה לוי', 'dana@example.com'), me] }),
    ev('evt-902', 0, 11, 0, 11, 50, 'פגישת מעקב · אבי פרץ', { location: 'קליניקה · חדר 1', attendees: [g('אבי פרץ', 'avi@example.com'), me] }),
    ev('evt-903', 1, 9, 30, 10, 20, 'פגישה שבועית · מיכל כהן', { hangoutLink: 'https://meet.google.com/abc-defg-hij', attendees: [g('מיכל כהן', 'michal@example.com'), me] }),
    ev('evt-904', 1, 12, 0, 12, 50, 'פגישת מעקב · רון אברהמי', { hangoutLink: 'https://meet.google.com/xyz-1234-lmn', attendees: [g('רון אברהמי', 'ron@example.com'), me] }),
    ev('evt-905', 1, 16, 0, 16, 50, 'פגישת אינטייק · נועה שפירא', { attendees: [g('נועה שפירא', 'noa@example.com', 'needsAction'), me] }),
    ev('evt-906', 2, 10, 0, 10, 50, 'פגישה שבועית · יוסי מזרחי', { location: 'קליניקה · חדר 1', attendees: [g('יוסי מזרחי', 'yossi@example.com', 'tentative'), me] }),
    ev('evt-907', 2, 13, 0, 13, 50, 'פגישת מעקב · דנה לוי', { hangoutLink: 'https://meet.google.com/pqr-5678-stu', attendees: [g('דנה לוי', 'dana@example.com'), me] }),
    ev('evt-908', 3, 9, 0, 9, 50, 'פגישה שבועית · מיכל כהן', { location: 'קליניקה · חדר 2', attendees: [g('מיכל כהן', 'michal@example.com'), me] }),
    { id: 'evt-909', status: 'confirmed', summary: 'יום השתלמות קלינית', start: { date: dayStr(3) }, end: { date: dayStr(4) }, htmlLink: 'https://calendar.google.com/calendar/r/eventedit/evt-909' },
    ev('evt-910', 4, 11, 0, 11, 50, 'פגישת מעקב · נועה שפירא', { hangoutLink: 'https://meet.google.com/def-9012-ghi', attendees: [g('נועה שפירא', 'noa@example.com'), me] }),
    ev('evt-911', 4, 15, 0, 15, 50, 'פגישה שבועית · יוסי מזרחי', { location: 'קליניקה · חדר 1', attendees: [g('יוסי מזרחי', 'yossi@example.com'), me] }),
  ];
  return items;
}

export async function loadCalFixture(weekAnchor = new Date()) {
  await new Promise((r) => setTimeout(r, 650));
  return { kind: 'calendar#events', items: buildCalFixtureItems(weekAnchor) };
}

const normName = (value: string) => value.trim().toLocaleLowerCase('he-IL');

export function patientIdsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Next reasonable slot for the schedule dialog (never in the past). */
export function defaultScheduleForm(pid: string, now = new Date()) {
  const slot = new Date(now);
  slot.setMinutes(slot.getMinutes() + 30 - (slot.getMinutes() % 30));
  if (slot <= now) slot.setMinutes(slot.getMinutes() + 30);
  if (slot.getHours() >= 20) {
    slot.setDate(slot.getDate() + 1);
    slot.setHours(9, 0, 0, 0);
  }
  const time = String(slot.getHours()).padStart(2, '0') + ':' + String(slot.getMinutes()).padStart(2, '0');
  return { pid, date: dayKey(slot), time, dur: '50', description: '' };
}

export function isUpcomingEvent(event: CalendarUiEvent, now = new Date()): boolean {
  return new Date(event.end) > now;
}

export function eventMatchesPatient(
  event: CalendarUiEvent,
  patientId: string,
  patientName: string,
): boolean {
  if (patientId && event.patientId) {
    if (String(event.patientId).toLowerCase() === String(patientId).toLowerCase()) return true;
  }
  const guest = (event.attendees || []).find((a) => !a.self);
  const name = normName(patientName);
  if (name && guest?.name && normName(guest.name) === name) return true;
  const title = normName(event.title || '');
  if (name && title.includes(name)) return true;
  return false;
}

export function localApptsToUiEvents(
  appts: Array<{ id?: string; pid: string; date?: string; time: string; dur?: number; description?: string }>,
  patientId: string,
  patientName: string,
  now = new Date(),
): CalendarUiEvent[] {
  return appts
    .filter((a) => patientIdsMatch(a.pid, patientId))
    .map((a) => scheduledApptToUiEvent(a, patientName))
    .filter((e) => isUpcomingEvent(e, now));
}

export function dbEventApiId(uiEventId: string): string {
  return uiEventId.startsWith('db-') ? uiEventId.slice(3) : uiEventId;
}

export function normalizeDbEvents(
  items: DbCalendarEvent[],
  resolvePatientName?: (patientId: string | null | undefined) => string | undefined,
): CalendarUiEvent[] {
  return (items || [])
    .map((e) => {
      const patientName = resolvePatientName?.(e.patient_id);
      const attendees = patientName
        ? [{ name: patientName, email: '', self: false, response: 'accepted' }]
        : [];
      return {
        id: 'db-' + e.id,
        title: e.title || '(ללא כותרת)',
        description: e.description || '',
        location: '',
        htmlLink: '',
        meetLink: '',
        allDay: false,
        start: new Date(e.start_at),
        end: new Date(e.end_at),
        status: 'confirmed',
        attendees,
        source: 'db' as const,
        patientId: e.patient_id ?? null,
      };
    })
    .sort((a, b) => +a.start - +b.start);
}

export function mergeCalendarEvents(...groups: CalendarUiEvent[][]): CalendarUiEvent[] {
  const seen = new Set<string>();
  const merged: CalendarUiEvent[] = [];
  for (const group of groups) {
    for (const event of group) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      merged.push(event);
    }
  }
  return merged.sort((a, b) => +a.start - +b.start);
}

/** Same patient + date + start time — used to collapse local + API duplicates. */
export function calendarEventSlotKey(event: CalendarUiEvent): string {
  const start = new Date(event.start);
  const pid = (event.patientId ?? '').toLowerCase();
  return pid + '@' + dayKey(start) + '@'
    + String(start.getHours()).padStart(2, '0') + ':'
    + String(start.getMinutes()).padStart(2, '0');
}

export function mergeCalendarEventsUnique(...groups: CalendarUiEvent[][]): CalendarUiEvent[] {
  const bySlot = new Map<string, CalendarUiEvent>();
  for (const group of groups) {
    for (const event of group) {
      const key = calendarEventSlotKey(event);
      const existing = bySlot.get(key);
      if (!existing) {
        bySlot.set(key, event);
        continue;
      }
      const existingDb = existing.id.startsWith('db-');
      const incomingDb = event.id.startsWith('db-');
      bySlot.set(key, incomingDb && !existingDb ? event : existing);
    }
  }
  return [...bySlot.values()].sort((a, b) => +a.start - +b.start);
}

export async function fetchDbCalendarEvents(
  timeMin: Date,
  signal?: AbortSignal,
  resolvePatientName?: (patientId: string | null | undefined) => string | undefined,
  timeMax?: Date,
): Promise<CalendarUiEvent[]> {
  if (!isApiConfigured()) return [];
  const from = dayKey(timeMin);
  const to = dayKey(timeMax ?? weekLastDay(timeMin));
  const items = await apiRequest<DbCalendarEvent[]>('/calendar', {
    query: { from, to, time_zone: CALENDAR_TIME_ZONE },
    signal,
    timeoutMs: 5000,
  });
  return normalizeDbEvents(items, resolvePatientName);
}

/** The patient-facing name for an event: the guest (non-self) attendee, or the
 *  name part of a "type · name" fixture title. Used by the week-view home and the
 *  mobile day view to label appointments. */
export function eventGuestName(event: CalendarUiEvent): string {
  const guest = (event.attendees || []).find((a) => !a.self) || event.attendees?.[0];
  if (guest?.name) return guest.name;
  const parts = (event.title || '').split('·');
  return (parts[1] || parts[0] || '').trim();
}

export function formatWeekRange(anchor: Date): string {
  const start = weekStart(anchor);
  const end = weekLastDay(anchor);
  const fmtDay = (d: Date) => d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  return fmtDay(start) + ' – ' + fmtDay(end);
}

export async function loadCalendarEvents(opts: {
  timeMin: Date
  timeMax: Date
  weekAnchor?: Date
  signal?: AbortSignal
  resolvePatientName?: (patientId: string | null | undefined) => string | undefined
}): Promise<CalendarUiEvent[]> {
  const anchor = opts.weekAnchor ?? opts.timeMin;

  if (!isApiConfigured()) {
    const fixturePayload = await loadCalFixture(anchor);
    return normalizeGoogleEvents((fixturePayload && fixturePayload.items) || []);
  }

  try {
    const dbEvents = await fetchDbCalendarEvents(
      opts.timeMin,
      opts.signal,
      opts.resolvePatientName,
    );
    return dbEvents;
  } catch (e: any) {
    if (e && e.name === 'AbortError' && opts.signal && opts.signal.aborted) throw e;
    return [];
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildAppointmentTimes(
  time: string,
  durationMin: number,
  day: Date | string = new Date(),
): { start_at: string; end_at: string } {
  const [h, m] = time.split(':').map(Number);
  let start: Date;
  if (typeof day === 'string') {
    const [y, mo, d] = day.split('-').map(Number);
    start = new Date(y, mo - 1, d, h, m, 0, 0);
  } else {
    start = new Date(day);
    start.setHours(h, m, 0, 0);
  }
  const end = new Date(start.getTime() + durationMin * 60_000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

export interface CalendarEventCreatePayload {
  title: string
  description?: string | null
  start_at: string
  end_at: string
  patient_id?: string | null
}

export function resolveCalendarEventApiId(eventId: string): string | null {
  if (eventId.startsWith('db-')) return eventId.slice(3);
  if (UUID_RE.test(eventId)) return eventId;
  return null;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const apiId = resolveCalendarEventApiId(eventId);
  if (!apiId) throw new Error('invalid calendar event id');
  await apiRequest<void>('/calendar/' + encodeURIComponent(apiId), { method: 'DELETE' });
}

export async function createCalendarEvent(payload: CalendarEventCreatePayload): Promise<DbCalendarEvent> {
  const body: CalendarEventCreatePayload = {
    title: payload.title,
    description: payload.description ?? null,
    start_at: payload.start_at,
    end_at: payload.end_at,
  };
  if (payload.patient_id && UUID_RE.test(payload.patient_id)) {
    body.patient_id = payload.patient_id;
  }
  return apiRequest<DbCalendarEvent>('/calendar', {
    method: 'POST',
    body,
    query: { time_zone: CALENDAR_TIME_ZONE },
  });
}

export function scheduledApptToUiEvent(
  appt: { id?: string; pid: string; date?: string; time: string; dur?: number; description?: string },
  patientName: string,
): CalendarUiEvent {
  const dateKey = appt.date || dayKey(new Date());
  const { start_at, end_at } = buildAppointmentTimes(appt.time, appt.dur ?? 50, dateKey);
  return {
    id: appt.id || `sched-${appt.pid}-${appt.time}`,
    title: patientName,
    description: appt.description || '',
    location: '',
    htmlLink: '',
    meetLink: '',
    allDay: false,
    start: new Date(start_at),
    end: new Date(end_at),
    status: 'confirmed',
    attendees: [{ name: patientName, email: '', self: false, response: 'accepted' }],
    source: 'db',
    patientId: appt.pid,
  };
}

export function toCalEventDetail(
  event: CalendarUiEvent,
  patientId: string | null = event.patientId ?? null,
) {
  const now = new Date();
  const start = new Date(event.start);
  const end = new Date(event.end);
  const active = start <= now && now < end;
  const ended = end <= now;
  const statusLabel = active ? 'מתקיימת כעת' : ended ? 'הסתיימה' : 'מתוכננת';
  const guest = (event.attendees || []).find((a) => !a.self) || event.attendees?.[0] || null;
  return {
    id: event.id,
    title: event.title,
    description: event.description || '',
    location: event.location || '',
    allDay: event.allDay,
    start: start.toISOString(),
    end: end.toISOString(),
    statusLabel,
    guestName: guest?.name || '',
    patientId,
  };
}

export async function loadPatientUpcomingEvents(opts: {
  patientId: string
  patientName: string
  scheduledAppts?: Array<{ id?: string; pid: string; date?: string; time: string; dur?: number; description?: string }>
  signal?: AbortSignal
  resolvePatientName?: (patientId: string | null | undefined) => string | undefined
}): Promise<CalendarUiEvent[]> {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + 90);

  let events: CalendarUiEvent[] = [];

  if (isApiConfigured()) {
    try {
      events = await fetchDbCalendarEvents(
        rangeStart,
        opts.signal,
        opts.resolvePatientName,
        rangeEnd,
      );
    } catch (e: any) {
      if (e?.name === 'AbortError' && opts.signal?.aborted) throw e;
      events = [];
    }
  }
  // Demo mode (no API): a patient's upcoming meetings come only from their own
  // scheduled appointments (`local` below), never the generic weekly calendar
  // fixture. That fixture is the calendar VIEW's demo schedule and isn't tied to
  // a patient, so injecting it here leaked stray same-named events into a
  // patient's list and made the count date-dependent (whichever generic slots
  // happened to still be upcoming today).

  const local = localApptsToUiEvents(opts.scheduledAppts || [], opts.patientId, opts.patientName, now);

  return mergeCalendarEventsUnique(events, local)
    .filter((e) => eventMatchesPatient(e, opts.patientId, opts.patientName))
    .filter((e) => isUpcomingEvent(e, now))
    .sort((a, b) => +a.start - +b.start);
}
