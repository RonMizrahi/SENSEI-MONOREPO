import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { findPatient, getPatient } from '../../utils';
import {
  eventMatchesPatient,
  isUpcomingEvent,
  loadPatientUpcomingEvents,
  localApptsToUiEvents,
  mergeCalendarEventsUnique,
  type CalendarUiEvent,
} from '../../services/calendar';

export function usePatientUpcomingMeetings() {
  const { S } = useApp();
  const [remoteMeetings, setRemoteMeetings] = useState<CalendarUiEvent[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const patientsRef = useRef(S.patients);
  patientsRef.current = S.patients;

  const cpExact = findPatient(S.patients, S.patientId) ?? findPatient(S.archivedPatients || [], S.patientId);
  const cp = cpExact ?? getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const meetingPatientId = S.patientId || cp.id;
  const meetingPatientName = cpExact?.name ?? cp.name;

  const localMeetings = useMemo(
    () => localApptsToUiEvents(S.scheduledAppts || [], meetingPatientId, meetingPatientName),
    [S.scheduledAppts, meetingPatientId, meetingPatientName],
  );

  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    const hidden = new Set(S.hiddenMeetingIds || []);
    return mergeCalendarEventsUnique(remoteMeetings, localMeetings)
      .filter((e) => !hidden.has(e.id))
      .filter((e) => eventMatchesPatient(e, meetingPatientId, meetingPatientName))
      .filter((e) => isUpcomingEvent(e, now))
      .sort((a, b) => +a.start - +b.start);
  }, [remoteMeetings, localMeetings, meetingPatientId, meetingPatientName, S.hiddenMeetingIds]);

  useEffect(() => {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    setRemoteLoading(true);
    loadPatientUpcomingEvents({
      patientId: meetingPatientId,
      patientName: meetingPatientName,
      scheduledAppts: [],
      signal: ac?.signal,
      resolvePatientName: (patientId) => {
        if (!patientId) return undefined;
        return patientsRef.current.find((p: any) => p.id === patientId)?.name;
      },
    })
      .then((events) => {
        if (ac?.signal.aborted) return;
        setRemoteMeetings(events);
        setRemoteLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setRemoteMeetings([]);
        setRemoteLoading(false);
      });
    return () => { if (ac) ac.abort(); };
  }, [meetingPatientId, meetingPatientName, S.calendarRefreshNonce]);

  const loading = remoteLoading && localMeetings.length === 0;

  return {
    cp,
    meetingPatientId,
    upcomingMeetings,
    loading,
  };
}
