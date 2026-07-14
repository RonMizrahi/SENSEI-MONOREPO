// Report (session-prep) — live API when configured; mock copy offline.
import { useRef, useEffect, useState, useMemo } from 'react';
import { CARD_SHADOW } from '../utils/styles';
import { useApp } from '../store/AppStore';
import { getPatient, avatarColors } from '../utils';
import { patientInitials, patientAvatarColor } from '../services/patients';
import { sessionSummaryText } from '../data/sessionDetail';
import { isApiConfigured } from '../services/apiClient';
import {
  localApptsToUiEvents,
  isUpcomingEvent,
  loadPatientUpcomingEvents,
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

function formatNextDateChip(start: Date | null): string {
  if (!start) return 'לא נקבעה';
  const dd = String(start.getDate()).padStart(2, '0');
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const yyyy = start.getFullYear();
  return dd + '.' + mm + '.' + yyyy;
}

function formatGeneratedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return dd + '.' + mm + '.' + yyyy + ' ' + hh + ':' + min;
}

export default function ReportPage() {
  const { S, set, navigate, toast } = useApp();
  const bTimer = useRef<any>(null);
  const [apiReport, setApiReport] = useState<NextMeetingReport | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [nextMeetingStart, setNextMeetingStart] = useState<Date | null>(null);

  useEffect(() => () => { if (bTimer.current) clearInterval(bTimer.current); }, []);

  const cp = getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const cpa = avatarColors(patientAvatarColor(cp.id));
  const useApi = isApiConfigured();

  // Resolve next meeting date (API calendar + local appts when wired).
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const fromLocal = () => {
      const now = new Date();
      const events = localApptsToUiEvents(S.scheduledAppts || [], cp.id, cp.name)
        .filter((e) => isUpcomingEvent(e, now))
        .sort((a, b) => +a.start - +b.start);
      return events[0]?.start ? new Date(events[0].start) : null;
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
        setNextMeetingStart(events[0]?.start ? new Date(events[0].start) : fromLocal());
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
    })
      .then((r) => {
        setApiReport(r);
        if (r.status === 'failed') {
          setApiError(r.error || 'יצירת הדוח נכשלה');
        }
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError' || ac.signal.aborted) return;
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
  }, [useApi, cp.id]);

  const goPatientFromSub = () => navigate('patient', { patientId: S.patientId });
  const goMeetingHistoryFromReport = () => navigate('meetingHistory', { patientId: S.patientId });

  // Force a fresh report; keep the current one visible until the new one is ready.
  const onRegenerate = () => {
    if (!useApi || !cp.id || regenerating) return;
    setRegenerating(true);
    setApiError('');
    regenerateNextMeetingReport(cp.id)
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

  const reportReady = !useApi || (apiReport?.status === 'ready');
  const reportIntro = useMemo(() => {
    if (useApi && apiReport?.status === 'ready') return apiReport.intro || '';
    return mockIntro(cp.name);
  }, [useApi, apiReport, cp.name]);
  const reportChanges = useMemo(() => {
    if (useApi && apiReport?.status === 'ready') return apiReport.changes || [];
    return MOCK_CHANGES;
  }, [useApi, apiReport]);
  const reportOpen = useMemo(() => {
    if (useApi && apiReport?.status === 'ready') return apiReport.open_topics || [];
    return MOCK_OPEN;
  }, [useApi, apiReport]);

  const lastSummary = useApi && apiReport?.last_summary_excerpt
    ? apiReport.last_summary_excerpt
    : sessionSummaryText(cp, 0);
  // Suggested opening questions are demo-only — the live report has no such
  // field, so hide them once a live report is ready.
  const reportQuestions = useApi && apiReport?.status === 'ready' ? [] : MOCK_QUESTIONS;

  const nextDateLabel = useApi
    ? formatNextDateChip(nextMeetingStart)
    : (nextMeetingStart ? formatNextDateChip(nextMeetingStart) : '06.07.2026');
  const nextWhenHint = nextMeetingStart ? formatMeetingWhen(nextMeetingStart) : '';
  const generatedAtLabel = useApi && apiReport?.status === 'ready'
    ? formatGeneratedAt(apiReport.generated_at)
    : '';

  const showSkeleton = (!useApi && S.loading) || (useApi && (apiLoading || apiReport?.status === 'pending' || apiReport?.status === 'running'));
  const showError = useApi && !apiLoading && (!!apiError || apiReport?.status === 'failed');
  const showBody = !showSkeleton && !showError && (!useApi || reportReady);

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
          <select value={cp.name} onChange={onTimelinePatient} aria-label="בחירת מטופל" style={{ height: 44, border: '1px solid var(--divider)', borderRadius: 10, padding: '0 14px', fontSize: 14, background: 'var(--paper)', color: 'var(--text-2)', outline: 'none', cursor: 'pointer' }}>
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

      {showError && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>לא ניתן להציג את הדוח</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {apiError || apiReport?.error || 'יצירת הדוח נכשלה'}
          </p>
          <a
            onClick={goMeetingHistoryFromReport}
            role="button"
            tabIndex={0}
            className="rep-history-link"
            style={{ display: 'inline-flex', fontSize: 14, color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
          >
            מעבר להיסטוריית הפגישות ›
          </a>
        </div>
      )}

      {showBody && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: cpView.avBg, color: cpView.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>{cpView.initials}</div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{cpView.name}</span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>טלפון: <span dir="ltr">{cpView.meta}</span></div>
              <button type="button" onClick={goPatientFromSub} className="rep-patient-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 9, padding: '7px 12px', border: '1px solid var(--primary-border)', borderRadius: 9, background: 'var(--primary-surface)', color: 'var(--primary-dark)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>
                מעבר לתיק מטופל
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, background: 'var(--primary-surface)', border: '1px solid var(--primary-border)' }}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--primary)"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>הפגישה הבאה</span>
                <span dir="ltr" style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }} title={nextWhenHint}>{nextDateLabel}</span>
              </div>
              {generatedAtLabel && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {regenerating ? 'מרעננים… · ' : ''}נוצר: <span dir="ltr">{generatedAtLabel}</span>
                </span>
              )}
            </div>
          </div>

          <div style={{ background: 'linear-gradient(120deg,var(--accent-grad-1),var(--accent-grad-2))', borderRadius: 10, padding: '22px 24px', color: 'var(--on-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--paper)"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" /></svg>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>סקירה מהירה</h2>
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, opacity: .95 }}>{reportIntro}</p>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={toggleBrief} aria-label="נגן תקציר קולי" className="rep-brief-btn" style={{ width: 50, height: 50, border: 'none', borderRadius: '50%', background: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(31,99,214,.3)' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--on-accent)"><path d={briefIcon} /></svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>תקציר קולי מהיר</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--secondary-bg)', color: 'var(--secondary-strong)' }}>AI</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>הקשבה מהירה בין פגישות · 1:48</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" /></svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>נקודות למעקב</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reportChanges.map((c) => (
                <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.55 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 8 }}></span>{c}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>מטרות לפגישה הקרובה</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reportOpen.length === 0 && useApi && apiReport?.status === 'ready' ? (
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  לא זוהו מטרות לפגישה הקרובה בסיכומים
                </p>
              ) : (
                reportOpen.map((o) => (
                  <div key={o} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--warning-strong)" style={{ flexShrink: 0, marginTop: 1 }}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM13 17h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>{o}
                  </div>
                ))
              )}
            </div>
          </div>

          {reportQuestions.length > 0 && (
            <div style={{ background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--primary)"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm1.07-7.75l-.9.92C13.45 9.9 13 10.5 13 12h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>שאלות מוצעות למפגש</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reportQuestions.map((q) => (
                  <div key={q} style={{ background: 'var(--paper)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--divider)' }}>
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--text)', fontStyle: 'italic' }}>&quot;{q}&quot;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
