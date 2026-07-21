// Report (session-prep) — live API when configured; mock copy offline.
import { useRef, useEffect, useState, useMemo } from 'react';
import { CARD_SHADOW } from '../utils/styles';
import { useApp } from '../store/AppStore';
import { getPatient, avatarColors } from '../utils';
import { fmtDate, fmtTime } from '../utils/dates';
import { patientInitials, patientAvatarColor } from '../services/patients';
import { sessionSummaryText } from '../data/sessionDetail';
import { getMockMeetingReport } from '../data/mockMeetingReports';
import AiDisclaimer from '../components/shared/AiDisclaimer';
import { isApiConfigured } from '../services/apiClient';
import {
  localApptsToUiEvents,
  isUpcomingEvent,
  loadPatientUpcomingEvents,
  dbEventApiId,
} from '../services/calendar';
import { formatMeetingWhen } from '../components/patient/UpcomingMeetingList';
import {
  pollNextMeetingReport,
  regenerateNextMeetingReport,
  type NextMeetingReport,
} from '../services/nextMeetingReport';
// Offline/demo fallback copy — single source (also used by the mobile prep report).
import { reportIntro as mockIntro, REPORT_CHANGES as MOCK_CHANGES, REPORT_OPEN as MOCK_OPEN, REPORT_QUESTIONS as MOCK_QUESTIONS } from '../data/reportContent';
import './report.css';

function formatIsoDateChip(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return iso;
  return dd + '/' + mm + '/' + yyyy.slice(-2);
}

function formatGeneratedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  return fmtDate(d) + ' ' + fmtTime(d);
}

export default function ReportPage() {
  const { S, set, navigate, toast } = useApp();
  const bTimer = useRef<any>(null);
  const [apiReport, setApiReport] = useState<NextMeetingReport | null>(null);
  // Start in the loading state when the API is configured so the first paint is the
  // skeleton, not a one-frame flash of the demo body before the live fetch begins.
  const [apiLoading, setApiLoading] = useState(() => isApiConfigured());
  const [apiError, setApiError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [nextMeetingStart, setNextMeetingStart] = useState<Date | null>(null);
  const [nextMeetingId, setNextMeetingId] = useState<string | null>(null);
  const reportMeetingId = (S.reportMeetingId as string | null | undefined) || nextMeetingId || undefined;

  useEffect(() => () => { if (bTimer.current) clearInterval(bTimer.current); }, []);

  const cp = getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const cpa = avatarColors(patientAvatarColor(cp.id));
  const useApi = isApiConfigured();
  const mockReport = !useApi ? getMockMeetingReport(cp.id) : null;

  // Resolve next meeting date (API calendar + local appts when wired).
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const fromLocal = () => {
      const now = new Date();
      const events = localApptsToUiEvents(S.scheduledAppts || [], cp.id, cp.name)
        .filter((e) => isUpcomingEvent(e, now))
        .sort((a, b) => +a.start - +b.start);
      const next = events[0];
      setNextMeetingId(next?.id ? dbEventApiId(next.id) : null);
      return next?.start ? new Date(next.start) : null;
    };

    if (!useApi) {
      setNextMeetingStart(fromLocal());
      return () => { cancelled = true; };
    }

    loadPatientUpcomingEvents({
      patientId: cp.id,
      patientName: cp.name,
      scheduledAppts: S.scheduledAppts || [],
      signal: ac.signal,
      resolvePatientName: (id) => S.patients.find((p: any) => p.id === id)?.name,
    })
      .then((events) => {
        if (cancelled) return;
        const next = events[0];
        setNextMeetingId(next?.id ? dbEventApiId(next.id) : null);
        setNextMeetingStart(next?.start ? new Date(next.start) : fromLocal());
      })
      .catch(() => {
        if (!cancelled) setNextMeetingStart(fromLocal());
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [useApi, cp.id, cp.name, S.scheduledAppts, S.patients]);

  // Load / generate live report when API is configured.
  useEffect(() => {
    if (!useApi || !cp.id) {
      setApiReport(null);
      setApiError('');
      setApiLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    setApiLoading(true);
    setApiError('');
    setApiReport(null);
    pollNextMeetingReport(cp.id, {
      signal: ac.signal,
      onUpdate: (r) => setApiReport(r),
      meetingId: reportMeetingId,
    })
      .then((r) => {
        setApiReport(r);
        if (r.status === 'failed') {
          setApiError(r.error || 'יצירת הדוח נכשלה');
        }
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError' || ac.signal.aborted) return;
        // Route absent on the deployed backend — quiet fallback to the local report.
        if (e?.code === 'NOT_AVAILABLE') return;
        setApiError(
          e?.details?.detail
          || e?.message
          || 'לא ניתן לטעון את דוח ההכנה',
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setApiLoading(false);
      });
    return () => ac.abort();
  }, [useApi, cp.id, reportMeetingId]);

  const goPatientFromSub = () => navigate('patient', { patientId: S.patientId });
  const goMeetingHistoryFromReport = () => navigate('meetingHistory', { patientId: S.patientId });

  // Force a fresh report; keep the current one visible until the new one is ready.
  const onRegenerate = () => {
    if (!useApi || !cp.id || regenerating) return;
    setRegenerating(true);
    setApiError('');
    regenerateNextMeetingReport(cp.id, { meetingId: reportMeetingId })
      .then((r) => {
        setApiReport(r);
        if (r.status === 'failed') {
          setApiError(r.error || 'יצירת הדוח נכשלה');
          toast('רענון הדוח נכשל', 'error');
        } else {
          toast('הדוח עודכן');
        }
      })
      .catch((e: any) => {
        if (e?.code === 'NOT_AVAILABLE') {
          // Route absent on the deployed backend — the local report stays current.
          toast('רענון מהשרת אינו זמין עדיין · מוצג הדוח המקומי');
          return;
        }
        setApiError(
          (typeof e?.details?.detail === 'string' && e.details.detail)
          || e?.message
          || 'לא ניתן לרענן את הדוח',
        );
        toast('רענון הדוח נכשל', 'error');
      })
      .finally(() => setRegenerating(false));
  };

  const cpView = {
    name: cp.name, initials: patientInitials(cp.name), avBg: cpa.bg, avColor: cpa.color,
    meta: cp.phone,
  };

  const patientOptions: string[] = S.patients.map((p: any) => p.name);
  const onTimelinePatient = (e: any) => { const p = S.patients.find((x: any) => x.name === e.target.value); if (p) navigate(S.route, { patientId: p.id }); };

  const reportIntro = useMemo(() => {
    if (useApi && apiReport?.status === 'ready') return apiReport.intro || '';
    if (mockReport) return mockReport.intro;
    return mockIntro(cp.name);
  }, [useApi, apiReport, mockReport, cp.name]);
  const reportChanges = useMemo(() => {
    if (useApi && apiReport?.status === 'ready') return apiReport.changes || [];
    if (mockReport) return mockReport.changes;
    return MOCK_CHANGES;
  }, [useApi, apiReport, mockReport]);
  const reportOpen = useMemo(() => {
    if (useApi && apiReport?.status === 'ready') return apiReport.open_topics || [];
    if (mockReport) return mockReport.open_topics;
    return MOCK_OPEN;
  }, [useApi, apiReport, mockReport]);

  const lastSummary = useApi && apiReport?.last_summary_excerpt
    ? apiReport.last_summary_excerpt
    : (mockReport?.last_summary ?? sessionSummaryText(cp, 0));
  const followUpPoints = reportOpen;
  const sessionGoals = reportChanges;
  // Per-patient mock (e.g. Simba) uses custom questions; generic demo uses REPORT_QUESTIONS.
  const suggestedQuestions = !useApi
    ? (mockReport?.suggested_questions ?? MOCK_QUESTIONS)
    : [];

  const nextDateLabel = useApi
    ? (nextMeetingStart ? formatMeetingWhen(nextMeetingStart) : 'לא נקבעה')
    : (mockReport?.nextMeetingDate
      ? formatIsoDateChip(mockReport.nextMeetingDate)
      : (nextMeetingStart ? formatMeetingWhen(nextMeetingStart) : '06.07.2026'));
  const nextWhenHint = nextMeetingStart ? formatMeetingWhen(nextMeetingStart) : '';
  const generatedAtLabel = useApi && apiReport?.status === 'ready'
    ? formatGeneratedAt(apiReport.generated_at)
    : '';

  const showSkeleton = (!useApi && S.loading) || (useApi && (apiLoading || apiReport?.status === 'pending' || apiReport?.status === 'running'));
  // A failed/unavailable live report (e.g. the Ollama model is missing) must never block
  // the page. Fall back to the demo prep body — the content memos above already return
  // demo copy when no live report is ready — with a subtle notice instead of an error wall.
  const liveFailed = useApi && !apiLoading && (!!apiError || apiReport?.status === 'failed');
  const showBody = !showSkeleton;

  // audio brief
  const secs = Math.round((S.briefProgress / 100) * 108);
  const briefCur = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  const briefIcon = S.briefPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z';
  const briefBars = Array.from({ length: 32 }, (_, i) => { const filled = (i / 32) * 100 <= S.briefProgress; return { h: (10 + Math.abs(Math.sin(i * 1.3)) * 22) + 'px', color: filled ? 'var(--primary)' : 'var(--primary-border)' }; });
  const toggleBrief = () => {
    if (S.briefPlaying) { clearInterval(bTimer.current); set({ briefPlaying: false }); return; }
    set({ briefPlaying: true, briefProgress: S.briefProgress >= 100 ? 0 : S.briefProgress });
    clearInterval(bTimer.current);
    bTimer.current = setInterval(() => {
      set((s: any) => { const np = s.briefProgress + 2; if (np >= 100) { clearInterval(bTimer.current); return { briefProgress: 100, briefPlaying: false }; } return { briefProgress: np }; });
    }, 120);
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <a onClick={goPatientFromSub} className="rep-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>{cp.name}</a>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>דוח הכנה</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>דוח הכנה לפגישה</h1>
          <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 15 }}>סיכום אוטומטי לקראת הפגישה הבאה</p>
          {generatedAtLabel && (
            <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              {regenerating ? 'מרעננים… · ' : ''}נוצר: <span dir="ltr">{generatedAtLabel}</span>
            </p>
          )}
          <a onClick={goMeetingHistoryFromReport} role="button" tabIndex={0} className="rep-history-link" style={{ display: 'inline-flex', fontSize: 13.5, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>היסטוריית הפגישות המלאה ›</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {useApi && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              aria-label="רענון דוח"
              className="rep-regen-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 16px',
                border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)',
                fontSize: 14, fontWeight: 600, color: 'var(--text-2)',
                cursor: regenerating ? 'default' : 'pointer', opacity: regenerating ? 0.6 : 1,
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" style={regenerating ? { animation: 'spin 1s linear infinite' } : undefined}><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
              {regenerating ? 'מרעננים…' : 'רענון דוח'}
            </button>
          )}
          <select value={cp.name} onChange={onTimelinePatient} aria-label="בחירת מטופל" className="app-select">
            {patientOptions.map((po) => (<option key={po}>{po}</option>))}
          </select>
        </div>
      </div>

      {showSkeleton && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26 }}>
          <div className="skeleton" style={{ width: '35%', height: 15, borderRadius: 6, background: 'linear-gradient(90deg,var(--skeleton-1) 25%,var(--skeleton-2) 37%,var(--skeleton-1) 63%)', backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', marginBottom: 14 }}></div>
          <div className="skeleton" style={{ width: '92%', height: 12, borderRadius: 6, background: 'linear-gradient(90deg,var(--skeleton-1) 25%,var(--skeleton-2) 37%,var(--skeleton-1) 63%)', backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear' }}></div>
          {useApi && (
            <p style={{ margin: '16px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>מייצרים דוח הכנה מסיכומי הפגישות…</p>
          )}
        </div>
      )}

      {showBody && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {liveFailed && (
            <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', boxShadow: CARD_SHADOW, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>
              <span>לא הצלחנו לייצר דוח חי כרגע. מוצג דוח הדגמה; אפשר לנסות שוב עם "רענון דוח".</span>
            </div>
          )}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: '20px 22px' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: 'var(--text-2)' }}>כרטיס מטופל</h2>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: cpView.avBg, color: cpView.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, flexShrink: 0 }}>{cpView.initials}</div>
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>שם המטופל: </span>
                  <span style={{ color: 'var(--text)' }}>{cpView.name}</span>
                </div>
                <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>הפגישה הבאה: </span>
                  <span dir="ltr" style={{ color: 'var(--primary)', fontWeight: 700 }} title={nextWhenHint}>{nextDateLabel}</span>
                </div>
                <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>טלפון: </span>
                  <span dir="ltr" style={{ color: 'var(--text)' }}>{cpView.meta}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={goPatientFromSub}
                    aria-label="מעבר לתיק מטופל"
                    className="rep-patient-link rep-patient-file-btn"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px',
                      border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--paper)',
                      fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>
                    מעבר לתיק מטופל
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(120deg,var(--accent-grad-1),var(--accent-grad-2))', borderRadius: 10, padding: '22px 24px', color: 'var(--on-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>סקירה מהירה</h2>
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, opacity: .95 }}>{reportIntro}</p>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={toggleBrief} aria-label="נגן תקציר קולי" className="rep-brief-btn" style={{ width: 50, height: 50, border: 'none', borderRadius: '50%', background: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(31,99,214,.3)' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--on-accent)"><path d={briefIcon} /></svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>תקציר קולי מהיר</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--secondary-bg)', color: 'var(--secondary-strong)' }}>AI</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>הקשבה מהירה בין פגישות (1:48 דקות)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 30 }}>
                {briefBars.map((bar, i) => (<div key={i} style={{ flex: 1, height: bar.h, background: bar.color, borderRadius: 2 }}></div>))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                <span dir="ltr">{briefCur}</span><span dir="ltr">1:48</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>סיכום הפגישה הקודמת</h2>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: 'var(--text)' }}>{lastSummary}</p>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>נקודות למעקב</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {followUpPoints.length === 0 && useApi && apiReport?.status === 'ready' ? (
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  לא זוהו נקודות למעקב בסיכומים
                </p>
              ) : (
                followUpPoints.map((o) => (
                  <div key={o} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.55 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning-strong)', flexShrink: 0, marginTop: 8 }}></span>{o}
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>מטרות לפגישה הקרובה</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessionGoals.map((c) => (
                <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.55 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 8 }}></span>{c}
                </div>
              ))}
            </div>
          </div>

          {suggestedQuestions.length > 0 && (
            <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22 }}>
              <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>שאלות מוצעות למפגש</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {suggestedQuestions.map((q) => (
                  <div key={q} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.55 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 8 }}></span>
                    <span>&ldquo;{q}&rdquo;</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <AiDisclaimer />
        </div>
      )}
    </div>
  );
}
