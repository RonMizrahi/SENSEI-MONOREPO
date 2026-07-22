// Dashboard "Focus" zone — the attention/action layer above the calendar. It
// answers, at a glance: who's next (and how to prepare), and what unfinished
// work to resume. Reuses the same store/services source as the rest of the app
// (scheduledAppts, sessionSummaries, notes/summary drafts) — no parallel state.
import { useApp } from '../store/AppStore';
import { getPatient, avatarColors, relativeWhen, heCount } from '../utils';
import { dashboardStats, openDraftPids } from '../utils/dashboardStats';
import { patientInitials, patientAvatarColor } from '../services/patients';
import { sessionSummaries } from '../data/sessions';
import { CARD_SHADOW } from '../utils/styles';

const iconBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px',
  border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--paper)',
  color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' as const,
};

export default function DashboardFocus() {
  const { S, set, navigate } = useApp();
  const now = new Date();

  // ---- who's next? (earliest upcoming appointment across all patients) ----
  const stats = dashboardStats(S.scheduledAppts, S.patients, now);
  const next = stats.next;
  const nextPatient = next ? getPatient(S.patients, next.pid, S.archivedPatients || []) : null;
  const nextRecap = next ? (sessionSummaries({ id: next.pid })[0] || '') : '';
  const nextRecapShort = nextRecap.length > 130 ? nextRecap.slice(0, 130).trim() + '…' : nextRecap;

  const openFile = (pid: string) => navigate('patient', { patientId: pid });
  const prep = (pid: string) => navigate('report', { patientId: pid });
  const upload = (pid: string) => navigate('upload', { patientId: pid, upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  const schedule = (pid: string) => set({ dialog: 'schedule', apptForm: { pid, date: '', time: '', dur: '50', description: '' }, errors: {} });

  const cardPerson = (pid: string) => {
    const p = getPatient(S.patients, pid, S.archivedPatients || []);
    const a = avatarColors(patientAvatarColor(pid));
    return { pid, name: p.name, initials: patientInitials(p.name), avBg: a.bg, avColor: a.color };
  };

  // ---- what to resume? (patients with unsaved notes/summary drafts) ----
  const drafts = openDraftPids(S.notesDrafts, S.summaryDrafts).map(cardPerson);

  // ---- who needs a follow-up scheduled? (active patients with no upcoming
  // appointment) — an attention prompt, shown only when there is one. ----
  const awaiting = stats.awaitingPids.map(cardPerson);
  const hasSide = drafts.length > 0 || awaiting.length > 0;

  return (
    <section aria-label="במוקד היום" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 18 }}>
      {/* Next session — the hero */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, boxShadow: CARD_SHADOW, padding: 18, gridColumn: hasSide ? 'auto' : '1 / -1' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.02em' }}>הפגישה הבאה</h2>
        {next && nextPatient ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: nextRecapShort ? 10 : 12 }}>
              <span style={{ width: 46, height: 46, borderRadius: '50%', background: avatarColors(patientAvatarColor(next.pid)).bg, color: avatarColors(patientAvatarColor(next.pid)).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{patientInitials(nextPatient.name)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextPatient.name}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginTop: 2 }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>
                  {relativeWhen(next.when, now)}
                </div>
              </div>
            </div>
            {nextRecapShort && (
              <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>מהפגישה הקודמת: </span>{nextRecapShort}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => prep(next.pid)} style={{ ...iconBtn, border: 'none', background: 'var(--primary)', color: 'var(--paper)', fontWeight: 700 }}>הצגת דוח ההכנה</button>
              <button type="button" onClick={() => upload(next.pid)} style={iconBtn}>העלאת הקלטה</button>
              <button type="button" onClick={() => openFile(next.pid)} style={iconBtn}>פתיחת התיק</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 0 4px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>אין פגישות מתוכננות. זה הזמן לתכנן את הימים הקרובים.</p>
            <button type="button" onClick={() => set({ dialog: 'schedule', apptForm: { pid: S.patients[0]?.id || 'p1', date: '', time: '', dur: '50', description: '' }, errors: {} })} style={{ ...iconBtn, border: 'none', background: 'var(--primary)', color: 'var(--paper)', fontWeight: 700 }}>קביעת פגישה</button>
          </div>
        )}
      </div>

      {/* Resume unfinished work — only when there is any */}
      {drafts.length > 0 && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, boxShadow: CARD_SHADOW, padding: 18 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.02em' }}>להמשך עבודה</h2>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>{heCount(drafts.length, 'טיוטה אחת שלא נשמרה', 'טיוטות שלא נשמרו')} · המשיכו מהמקום שבו הפסקתם.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {drafts.slice(0, 4).map((d) => (
              <button key={d.pid} type="button" onClick={() => openFile(d.pid)} aria-label={'המשך עריכה · ' + d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--paper)', padding: '8px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: d.avBg, color: d.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{d.initials}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--text-muted)" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Needs a follow-up scheduled — active patients with no upcoming session */}
      {awaiting.length > 0 && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, boxShadow: CARD_SHADOW, padding: 18 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.02em' }}>לתיאום פגישה</h2>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>{heCount(awaiting.length, 'מטופל אחד ללא פגישה קרובה', 'מטופלים ללא פגישה קרובה')} · קבעו את המפגש הבא.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {awaiting.slice(0, 4).map((d) => (
              <div key={d.pid} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 9, background: 'var(--paper)', padding: '8px 11px' }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: d.avBg, color: d.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{d.initials}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                <button type="button" onClick={() => schedule(d.pid)} aria-label={'קביעת פגישה · ' + d.name} style={{ ...iconBtn, height: 30, padding: '0 12px' }}>קביעת פגישה</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
