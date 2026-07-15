// Resolves a patient's next-meeting prep-report content: the live senseiapi
// report (polled) when VITE_API_BASE_URL is set, falling back to the shared demo
// copy otherwise — the same resolution the desktop ReportPage does, exposed as a
// hook so the mobile prep report shows live data too. Store data (patientId /
// name / demo fallbacks) is passed as args (leaf-layering rule).
import { useEffect, useMemo, useState } from 'react';
import { isApiConfigured } from '../services/apiClient';
import { pollNextMeetingReport, type NextMeetingReport } from '../services/nextMeetingReport';
import { reportIntro, REPORT_CHANGES, REPORT_OPEN, REPORT_QUESTIONS } from '../data/reportContent';

export interface ResolvedReport {
  live: boolean          // showing API-generated content (vs demo copy)
  loading: boolean
  error: string
  intro: string
  changes: string[]
  openTopics: string[]
  questions: string[]    // suggested opening questions (live from the API, or demo copy)
  summary: string
  insight: string
}

export function useNextMeetingReport(
  patientId: string,
  patientName: string,
  demoSummary: string,
  demoInsight: string,
): ResolvedReport {
  const useApi = isApiConfigured();
  const [report, setReport] = useState<NextMeetingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!useApi || !patientId) {
      setReport(null);
      setError('');
      setLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    setLoading(true);
    setError('');
    setReport(null);
    pollNextMeetingReport(patientId, { signal: ac.signal, onUpdate: setReport })
      .then((r) => {
        setReport(r);
        if (r.status === 'failed') setError(r.error || 'יצירת הדוח נכשלה');
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError' || ac.signal.aborted) return;
        setError(e?.details?.detail || e?.message || 'לא ניתן לטעון את דוח ההכנה');
      })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [useApi, patientId]);

  return useMemo(() => {
    const ready = useApi && report?.status === 'ready';
    const excerpt = useApi ? report?.last_summary_excerpt : null;
    return {
      live: !!ready,
      loading: useApi && (loading || report?.status === 'pending' || report?.status === 'running'),
      error: useApi ? error : '',
      intro: ready ? (report?.intro || '') : reportIntro(patientName),
      changes: ready ? (report?.changes || []) : REPORT_CHANGES,
      openTopics: ready ? (report?.open_topics || []) : REPORT_OPEN,
      // Live report now carries questions (M5); fall back to demo copy if it has none.
      questions: ready ? (report?.questions?.length ? report.questions : REPORT_QUESTIONS) : REPORT_QUESTIONS,
      summary: excerpt || demoSummary,
      insight: excerpt ? excerpt.slice(0, 280) : demoInsight,
    };
  }, [useApi, report, loading, error, patientName, demoSummary, demoInsight]);
}
