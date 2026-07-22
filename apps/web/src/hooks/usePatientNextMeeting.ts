import { useEffect, useState } from 'react';
import { isApiConfigured } from '../services/apiClient';
import {
  isUpcomingEvent,
  loadPatientUpcomingEvents,
  localApptsToUiEvents,
} from '../services/calendar';

function nextMeetingFromLocal(
  scheduledAppts: Array<{ id?: string; pid: string; date?: string; time: string; dur?: number; description?: string }>,
  patientId: string,
  patientName: string,
): Date | null {
  const now = new Date();
  const events = localApptsToUiEvents(scheduledAppts || [], patientId, patientName)
    .filter((e) => isUpcomingEvent(e, now))
    .sort((a, b) => +a.start - +b.start);
  const next = events[0];
  return next?.start ? new Date(next.start) : null;
}

/** Earliest upcoming meeting for a patient (API calendar + local appts offline). */
export function usePatientNextMeeting(
  patientId: string,
  patientName: string,
  scheduledAppts: Array<{ id?: string; pid: string; date?: string; time: string; dur?: number; description?: string }>,
  patients: Array<{ id: string; name: string }>,
  calendarRefreshNonce = 0,
) {
  const [nextMeetingStart, setNextMeetingStart] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setNextMeetingStart(null);
      setLoading(false);
      return undefined;
    }

    if (!isApiConfigured()) {
      setLoading(false);
      setNextMeetingStart(nextMeetingFromLocal(scheduledAppts || [], patientId, patientName));
      return undefined;
    }

    const ac = new AbortController();
    setLoading(true);
    loadPatientUpcomingEvents({
      patientId,
      patientName,
      scheduledAppts: scheduledAppts || [],
      signal: ac.signal,
      resolvePatientName: (id) => patients.find((p) => p.id === id)?.name,
    })
      .then((events) => {
        const next = events[0];
        setNextMeetingStart(next?.start ? new Date(next.start) : null);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setNextMeetingStart(nextMeetingFromLocal(scheduledAppts || [], patientId, patientName));
        setLoading(false);
      });

    return () => { ac.abort(); };
  }, [patientId, patientName, scheduledAppts, patients, calendarRefreshNonce]);

  return { nextMeetingStart, loading };
}
