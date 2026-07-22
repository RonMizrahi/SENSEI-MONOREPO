// Loads a week's calendar events (fixture or senseiapi `/calendar`, per config)
// merged with the locally-scheduled appointments that fall inside that week.
// Shared by the desktop week-view home and the mobile day view. Store data is
// passed in as arguments — hooks/ must not import from store/ (layering rule).
import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPatient } from '../utils';
import {
  dayKey,
  loadCalendarEvents,
  mergeCalendarEventsUnique,
  scheduledApptToUiEvent,
  weekEnd,
  weekStart,
  type CalendarUiEvent,
} from '../services/calendar';
import { queryKeys } from '../query/keys';

export interface WeekEvents {
  events: CalendarUiEvent[]
  loading: boolean
  /** the last load failed (real API error — not an abort); events may be stale/empty */
  error: boolean
  /** re-run the failed load (retry affordance for the API-backed mode) */
  reload: () => void
  weekStartDate: Date
}

export function useWeekEvents(weekAnchor: Date, scheduledAppts: any[], patients: any[]): WeekEvents {
  // Key everything on the numeric week-start so a fresh `weekAnchor` Date with the
  // same week doesn't re-fire the load; `wkStart` identity is then stable per week.
  const wkStartMs = weekStart(weekAnchor).getTime();
  const wkStart = useMemo(() => new Date(wkStartMs), [wkStartMs]);
  const from = dayKey(wkStart);
  const to = dayKey(weekEnd(wkStart));

  const patientsRef = useRef(patients);
  patientsRef.current = patients;

  const query = useQuery({
    queryKey: queryKeys.calendarWeek(from, to),
    queryFn: ({ signal }) => loadCalendarEvents({
      timeMin: wkStart,
      timeMax: weekEnd(wkStart),
      weekAnchor: wkStart,
      signal,
      resolvePatientName: (pid) => (pid ? patientsRef.current.find((p: any) => p.id === pid)?.name : undefined),
    }),
    // Demo mode still needs the fixture path inside loadCalendarEvents.
    enabled: true,
    // When API is off, loadCalendarEvents returns the fixture without network.
    staleTime: 30_000,
    // Surface failures to the UI retry button — don't auto-retry quietly.
    retry: false,
  });

  const scheduled = useMemo(() => {
    const we = weekEnd(wkStart);
    return (scheduledAppts || [])
      .map((a: any) => scheduledApptToUiEvent(a, getPatient(patients, a.pid).name))
      .filter((e: CalendarUiEvent) => e.start >= wkStart && e.start < we);
  }, [scheduledAppts, patients, wkStart]);

  const remote = useMemo(() => query.data ?? [], [query.data]);
  const merged = useMemo(() => mergeCalendarEventsUnique(remote, scheduled), [remote, scheduled]);

  return {
    events: merged,
    loading: query.isLoading || (query.isFetching && !query.data),
    error: query.isError,
    reload: () => { void query.refetch(); },
    weekStartDate: wkStart,
  };
}
