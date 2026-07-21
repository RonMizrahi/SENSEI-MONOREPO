// Patient meeting history — seeded demo sessions offline; calendar + summaries live.
import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../store/AppStore';
import { findPatient, getPatient } from '../../utils';
import { isApiConfigured } from '../../services/apiClient';
import {
  dbEventApiId,
  loadPatientPastEvents,
  resolveCalendarEventApiId,
  type CalendarUiEvent,
} from '../../services/calendar';
import { fetchMeetingSummary } from '../../services/meetingSummary';
import { parseSummaryContent, summaryPreviewText } from '../../services/summaryDisplay';
import { sessionSummaries } from '../../data/sessions';
import { fmtDate } from '../../utils/dates';
import {
  buildPatientSessions,
  enrichPatientSessions,
  type PatientSessionBase,
} from '../../utils/patientSessions';
import { formatMeetingWhen } from './UpcomingMeetingList';
import { queryKeys } from '../../query/keys';

function meetingDurationLabel(event: CalendarUiEvent): string {
  const mins = Math.max(1, Math.round((+new Date(event.end) - +new Date(event.start)) / 60_000));
  return mins + ' דק׳';
}

function eventToSessionBase(
  event: CalendarUiEvent,
  num: number,
  patientId: string,
  patientName: string,
  ctx: {
    navigate: (route: string, patch?: Record<string, unknown>) => void
    set: (patch: Record<string, unknown>) => void
  },
  summaryText: string,
): PatientSessionBase {
  const meetingId = resolveCalendarEventApiId(event.id) || dbEventApiId(event.id);
  const openSummary = () => ctx.navigate('summary', { patientId, meetingId });
  return {
    num,
    key: meetingId || event.id,
    date: fmtDate(new Date(event.start)),
    duration: meetingDurationLabel(event),
    summary: summaryText,
    riskChips: [],
    topRiskLabel: '',
    topRiskColor: '',
    topRiskBg: '',
    onSummary: openSummary,
    onTranscript: () => ctx.navigate('transcript', { patientId, meetingId }),
    onOpen: openSummary,
    onDelete: (e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      ctx.set({
        dialog: 'delMeeting',
        dialogMeetingId: event.id,
        dialogMeetingLabel: (patientName || 'פגישה') + ' · ' + formatMeetingWhen(new Date(event.start)),
      });
    },
  };
}

async function enrichSummaries(
  events: CalendarUiEvent[],
  limit: number,
  signal?: AbortSignal,
): Promise<{ byMeetingId: Record<string, string>; latestSummaryText: string }> {
  const slice = events.slice(0, limit);
  const byMeetingId: Record<string, string> = {};
  let latestSummaryText = '';

  const results = await Promise.allSettled(
    slice.map(async (event) => {
      const meetingId = resolveCalendarEventApiId(event.id) || dbEventApiId(event.id);
      if (!meetingId) return { meetingId: '', text: '' };
      try {
        const s = await fetchMeetingSummary(meetingId, signal);
        const text = s.status === 'ready' && s.text ? String(s.text) : '';
        return { meetingId, text };
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        return { meetingId, text: '' };
      }
    }),
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { meetingId, text } = r.value;
    if (!meetingId) continue;
    byMeetingId[meetingId] = text ? summaryPreviewText(text) : '';
    if (!latestSummaryText && text) {
      // Recap uses Simba-style prose, never raw JSON / ## markdown dump.
      latestSummaryText = parseSummaryContent(text)?.displayText || summaryPreviewText(text, 400);
    }
  }
  return { byMeetingId, latestSummaryText };
}

export function usePatientMeetingHistory(opts?: { enrichLimit?: number }) {
  const { S, set, navigate } = useApp();
  const useApi = isApiConfigured();
  const enrichLimit = opts?.enrichLimit ?? 20;

  const patientsRef = useRef(S.patients);
  patientsRef.current = S.patients;

  const cpExact = findPatient(S.patients, S.patientId) ?? findPatient(S.archivedPatients || [], S.patientId);
  const cp = cpExact ?? getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const patientId = S.patientId || cp.id;
  const patientName = cpExact?.name ?? cp.name;

  const demoSessions = useMemo(() => {
    if (useApi) return [];
    return buildPatientSessions(cp, S.deletedSessions || [], { navigate, set });
  }, [useApi, cp, S.deletedSessions, navigate, set]);

  const pastQuery = useQuery({
    queryKey: queryKeys.patientPast(patientId),
    queryFn: ({ signal }) => loadPatientPastEvents({
      patientId,
      patientName,
      signal,
      resolvePatientName: (id) => {
        if (!id) return undefined;
        return patientsRef.current.find((p: any) => p.id === id)?.name;
      },
    }),
    enabled: useApi && !!patientId,
  });

  const remoteEvents = useMemo(() => pastQuery.data ?? [], [pastQuery.data]);
  const hidden = useMemo(() => new Set(S.hiddenMeetingIds || []), [S.hiddenMeetingIds]);
  const visibleEvents = useMemo(
    () => remoteEvents.filter((e) => !hidden.has(e.id)),
    [remoteEvents, hidden],
  );

  const summariesQuery = useQuery({
    queryKey: [...queryKeys.patientPast(patientId), 'summaries', enrichLimit, visibleEvents.map((e) => e.id).join(',')],
    queryFn: ({ signal }) => enrichSummaries(visibleEvents, enrichLimit, signal),
    enabled: useApi && visibleEvents.length > 0 && pastQuery.isSuccess,
  });

  const summaryByMeeting = useMemo(
    () => summariesQuery.data?.byMeetingId ?? {},
    [summariesQuery.data?.byMeetingId],
  );
  const latestSummaryText = summariesQuery.data?.latestSummaryText ?? '';

  const apiSessions: PatientSessionBase[] = useMemo(() => {
    if (!useApi) return [];
    const total = visibleEvents.length;
    return visibleEvents.map((event, i) => {
      const num = total - i;
      const meetingId = resolveCalendarEventApiId(event.id) || dbEventApiId(event.id);
      const summary = summaryByMeeting[meetingId] || '';
      return eventToSessionBase(event, num, patientId, patientName, { navigate, set }, summary);
    });
  }, [useApi, visibleEvents, summaryByMeeting, patientId, patientName, navigate, set]);

  const baseSessions = useApi ? apiSessions : demoSessions;
  const sessions = enrichPatientSessions(baseSessions, S, patientId);

  const recapText = useApi
    ? latestSummaryText
    : (sessionSummaries(cp)[0] || '');

  const loading = useApi && (
    pastQuery.isLoading
    || pastQuery.isFetching && !pastQuery.data
    || (visibleEvents.length > 0 && summariesQuery.isLoading && !summariesQuery.data)
  );

  return {
    cp,
    patientId,
    useApi,
    sessions,
    loading,
    error: pastQuery.isError
      ? ((pastQuery.error as Error)?.message || 'לא ניתן לטעון את היסטוריית הפגישות')
      : '',
    latestSummaryText: recapText,
    totalCount: baseSessions.length,
  };
}
