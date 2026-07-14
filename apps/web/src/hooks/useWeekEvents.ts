// Loads a week's calendar events (fixture or senseiapi `/calendar`, per config)
// merged with the locally-scheduled appointments that fall inside that week.
// Shared by the desktop week-view home and the mobile day view. Store data is
// passed in as arguments — hooks/ must not import from store/ (layering rule).
import { useEffect, useMemo, useRef, useState } from 'react';
import { getPatient } from '../utils';
import {
  loadCalendarEvents,
  mergeCalendarEventsUnique,
  scheduledApptToUiEvent,
  weekEnd,
  weekStart,
  type CalendarUiEvent,
} from '../services/calendar';

export interface WeekEvents {
  events: CalendarUiEvent[]
  loading: boolean
  weekStartDate: Date
}

export function useWeekEvents(weekAnchor: Date, scheduledAppts: any[], patients: any[]): WeekEvents {
  // Key everything on the numeric week-start so a fresh `weekAnchor` Date with the
  // same week doesn't re-fire the load; `wkStart` identity is then stable per week.
  const wkStartMs = weekStart(weekAnchor).getTime();
  const wkStart = useMemo(() => new Date(wkStartMs), [wkStartMs]);

  const [events, setEvents] = useState<CalendarUiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const patientsRef = useRef(patients);
  patientsRef.current = patients;

  useEffect(() => {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let alive = true;
    setLoading(true);
    loadCalendarEvents({
      timeMin: wkStart,
      timeMax: weekEnd(wkStart),
      weekAnchor: wkStart,
      signal: ac?.signal,
      resolvePatientName: (pid) => (pid ? patientsRef.current.find((p: any) => p.id === pid)?.name : undefined),
    })
      .then((evs) => { if (alive) { setEvents(evs); setLoading(false); } })
      .catch((err) => { if (err?.name === 'AbortError') return; if (alive) { setEvents([]); setLoading(false); } });
    return () => { alive = false; if (ac) try { ac.abort(); } catch { /* ignore */ } };
  }, [wkStart]);

  const scheduled = useMemo(() => {
    const we = weekEnd(wkStart);
    return (scheduledAppts || [])
      .map((a: any) => scheduledApptToUiEvent(a, getPatient(patients, a.pid).name))
      .filter((e: CalendarUiEvent) => e.start >= wkStart && e.start < we);
  }, [scheduledAppts, patients, wkStart]);

  const merged = useMemo(() => mergeCalendarEventsUnique(events, scheduled), [events, scheduled]);

  return { events: merged, loading, weekStartDate: wkStart };
}
