import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../store/AppStore';
import { findPatient, getPatient } from '../../utils';
import { isApiConfigured } from '../../services/apiClient';
import {
  eventMatchesPatient,
  isUpcomingEvent,
  loadPatientUpcomingEvents,
  localApptsToUiEvents,
  mergeCalendarEventsUnique,
} from '../../services/calendar';
import { queryKeys } from '../../query/keys';

export function usePatientUpcomingMeetings() {
  const { S } = useApp();
  const patientsRef = useRef(S.patients);
  patientsRef.current = S.patients;

  const cpExact = findPatient(S.patients, S.patientId) ?? findPatient(S.archivedPatients || [], S.patientId);
  const cp = cpExact ?? getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const meetingPatientId = S.patientId || cp.id;
  const meetingPatientName = cpExact?.name ?? cp.name;
  const useApi = isApiConfigured();

  const localMeetings = useMemo(
    () => localApptsToUiEvents(S.scheduledAppts || [], meetingPatientId, meetingPatientName),
    [S.scheduledAppts, meetingPatientId, meetingPatientName],
  );

  const query = useQuery({
    queryKey: queryKeys.patientUpcoming(meetingPatientId),
    queryFn: ({ signal }) => loadPatientUpcomingEvents({
      patientId: meetingPatientId,
      patientName: meetingPatientName,
      scheduledAppts: [],
      signal,
      resolvePatientName: (patientId) => {
        if (!patientId) return undefined;
        return patientsRef.current.find((p: any) => p.id === patientId)?.name;
      },
    }),
    enabled: useApi && !!meetingPatientId,
  });

  const remoteMeetings = useMemo(() => query.data ?? [], [query.data]);

  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    const hidden = new Set(S.hiddenMeetingIds || []);
    return mergeCalendarEventsUnique(remoteMeetings, localMeetings)
      .filter((e) => !hidden.has(e.id))
      .filter((e) => eventMatchesPatient(e, meetingPatientId, meetingPatientName))
      .filter((e) => isUpcomingEvent(e, now))
      .sort((a, b) => +a.start - +b.start);
  }, [remoteMeetings, localMeetings, meetingPatientId, meetingPatientName, S.hiddenMeetingIds]);

  const remoteLoading = useApi && (query.isLoading || query.isFetching) && !query.data;
  const loading = remoteLoading && localMeetings.length === 0;

  return {
    cp,
    meetingPatientId,
    upcomingMeetings,
    loading,
  };
}
