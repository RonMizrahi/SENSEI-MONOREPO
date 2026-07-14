// Single recorded session — insight, summary, and transcript on one page.
import { useApp } from '../store/AppStore';
import { getPatient } from '../utils';
import { buildPatientSessions, demoSessionCount } from '../utils/patientSessions';
import {
  sessionIndexForNum,
  sessionInsight,
  sessionSummaryText,
  sessionTranscriptExcerpt,
} from '../data/sessionDetail';
import { CARD_SHADOW } from '../utils/styles';
import './session.css';

export default function SessionDetailPage() {
  const { S, set, navigate } = useApp();
  const cp = getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const sessionNum = S.sessionNum;
  const ctx = { navigate, set };
  const sessions = buildPatientSessions(cp, S.deletedSessions || [], ctx);
  const session = sessions.find((s) => s.num === sessionNum) ?? null;
  const total = demoSessionCount(cp);
  const idx = sessionNum != null ? sessionIndexForNum(sessionNum, total) : 0;

  const goHistory = () => navigate('meetingHistory', { patientId: S.patientId });
  const goPatient = () => navigate('patient', { patientId: S.patientId });
  const goFullSummary = () => navigate('summary', { patientId: S.patientId });
  const goFullTranscript = () => navigate('transcript', { patientId: S.patientId });

  const insight = sessionInsight(cp, idx);
  const summary = session ? session.summary : sessionSummaryText(cp, idx);
  const transcript = sessionTranscriptExcerpt(cp, idx);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <a onClick={goPatient} className="sesd-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>{cp.name}</a>
        <span>›</span>
        <a onClick={goHistory} className="sesd-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>היסטוריית פגישות</a>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>פגישה {sessionNum ?? '—'}</span>
      </div>

      {S.loading && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26 }}>
          <div className="skeleton" style={{ width: '40%', height: 16, borderRadius: 6, marginBottom: 14 }} />
          <div className="skeleton" style={{ width: '100%', height: 12, borderRadius: 6 }} />
        </div>
      )}

      {!S.loading && !session && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, padding: 28, textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)' }}>הפגישה לא נמצאה.</p>
          <button type="button" onClick={goHistory} style={{ height: 40, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontWeight: 600, cursor: 'pointer' }}>חזרה להיסטוריה</button>
        </div>
      )}

      {!S.loading && session && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>פגישה {session.num}</h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
                {cp.name} · <span dir="ltr">{session.date}</span> · {session.duration}
              </p>
            </div>
          </div>

          <section style={{ background: 'linear-gradient(120deg,var(--accent-grad-1),var(--accent-grad-2))', borderRadius: 10, padding: '22px 24px', color: 'var(--on-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--paper)"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" /></svg>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>תובנה</h2>
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, opacity: .95 }}>{insight}</p>
          </section>

          <section style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>סיכום הפגישה</h2>
              <button type="button" onClick={goFullSummary} className="sesd-link-btn" style={{ height: 34, padding: '0 12px', border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--paper)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}>סיכום AI מלא ›</button>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: 'var(--text)' }}>{summary}</p>
          </section>

          <section style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>תמלול</h2>
              <button type="button" onClick={goFullTranscript} className="sesd-link-btn" style={{ height: 34, padding: '0 12px', border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--paper)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}>תמלול מלא ›</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {transcript.map((line, i) => (
                <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: i % 2 === 0 ? 'var(--primary-tint)' : 'var(--surface-2)', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{line.speaker}</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{line.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
