// Mobile prep report (design: "Sensei Mobile · Prep report") for the report /
// nextMeetingReport routes. Same content as the desktop ReportPage — the LIVE
// senseiapi next-meeting report when configured (via useNextMeetingReport),
// falling back to the shared demo copy otherwise — in a touch layout, plus
// start-recording / patient CTAs.
import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { getPatient } from '../../utils';
import { sessionInsight, sessionSummaryText } from '../../data/sessionDetail';
import { useNextMeetingReport } from '../../hooks/useNextMeetingReport';
import { ChevronStartIcon } from './icons';

interface Props {
  onOpenRecording: (pid: string, name: string, meetingId?: string) => void;
}

export default function MobilePrepReport({ onOpenRecording }: Props) {
  const { S, navigate } = useApp();
  const cp = getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const [goalsDone, setGoalsDone] = useState<Record<number, boolean>>({});

  const report = useNextMeetingReport(cp.id, cp.name, sessionSummaryText(cp, 0), sessionInsight(cp, 0));
  // Mirror ReportPage: skeleton / error / body are mutually exclusive, so demo
  // fallback copy is never shown as if it were the patient's live report.
  const showBody = !report.loading && !report.error;

  return (
    <div className="mob-screen">
      <div className="mob-screen-header">
        <button type="button" className="mob-back" aria-label="חזרה" onClick={() => window.history.back()}>
          <ChevronStartIcon size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>דוח הכנה · {cp.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>סיכום אוטומטי לקראת הפגישה הבאה</div>
        </div>
        <span className="mob-badge">נוצר ע״י AI</span>
      </div>

      <div className="mob-screen-body">
        {report.loading && (
          <div className="mob-card" role="status" aria-live="polite">
            <div className="skeleton" style={{ height: 13, width: '45%', borderRadius: 6, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 11, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 11, width: '80%', borderRadius: 6 }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>מכינים את דוח ההכנה…</div>
          </div>
        )}
        {!report.loading && report.error && (
          <div className="mob-card" role="alert">
            <div className="mob-card-title">לא ניתן לטעון את הדוח</div>
            <div className="mob-card-body" style={{ color: 'var(--error)' }}>{report.error}</div>
          </div>
        )}
        {showBody && (<>
        <div className="mob-card" style={{ background: 'var(--primary-tint)', border: 'none' }}>
          <div className="mob-card-title">סקירה מהירה</div>
          <div className="mob-card-body">{report.intro}</div>
        </div>

        <div className="mob-card">
          <div className="mob-card-title">סיכום הפגישה הקודמת</div>
          <div className="mob-card-body">{report.summary}</div>
        </div>

        <div className="mob-card">
          <div className="mob-card-title">נקודות למעקב</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {report.changes.map((t) => (
              <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 7, flexShrink: 0 }} />
                <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mob-card">
          <div className="mob-card-title">מטרות לפגישה הקרובה</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.openTopics.map((t, i) => {
              const done = !!goalsDone[i];
              return (
                <button
                  key={t}
                  type="button"
                  className="mob-goal"
                  aria-pressed={done}
                  onClick={() => setGoalsDone((g) => ({ ...g, [i]: !done }))}
                >
                  <span className={'mob-check' + (done ? ' is-done' : '')} aria-hidden>{done ? '✓' : ''}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.5, color: done ? 'var(--text-muted)' : 'var(--text-2)', textDecoration: done ? 'line-through' : 'none' }}>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {report.questions.length > 0 && (
          <div className="mob-card">
            <div className="mob-card-title">שאלות מוצעות למפגש</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {report.questions.map((q) => (
                <div key={q} style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)', fontStyle: 'italic' }}>&quot;{q}&quot;</div>
              ))}
            </div>
          </div>
        )}
        </>)}
      </div>

      <div className="mob-footer">
        <button type="button" className="mob-ghost-btn" onClick={() => onOpenRecording(cp.id, cp.name)}>התחל הקלטה</button>
        <button type="button" className="mob-primary-btn" style={{ marginTop: 0 }} onClick={() => navigate('patient', { patientId: cp.id })}>תיק מטופל</button>
      </div>
    </div>
  );
}
