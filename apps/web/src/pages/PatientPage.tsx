// Patient detail — profile, clinical notes, upcoming meetings, meeting history preview.
import { useEffect } from 'react';
import { useApp } from '../store/AppStore';
import { isApiConfigured } from '../services/apiClient';
import { fetchPatientNote, savePatientNote } from '../services/notes';
import { avatarColors } from '../utils';
import { buildPatientSessions, enrichPatientSessions } from '../utils/patientSessions';
import PatientSessionList from '../components/patient/PatientSessionList';
import UpcomingMeetingList, { formatMeetingWhen } from '../components/patient/UpcomingMeetingList';
import { usePatientUpcomingMeetings } from '../components/patient/usePatientUpcomingMeetings';
import { patientInitials, patientAvatarColor, formatPatientSince, displayPatientEmail } from '../services/patients';
import { defaultScheduleForm, toCalEventDetail, type CalendarUiEvent } from '../services/calendar';
import './patient.css';
import { CARD_SHADOW } from '../utils/styles';

const HISTORY_PREVIEW = 5;
const UPCOMING_PREVIEW = 5;

export default function PatientPage() {
  const { S, set, navigate, toast } = useApp();
  const { cp, meetingPatientId, upcomingMeetings, loading: meetingsLoading } = usePatientUpcomingMeetings();
  const cpa = avatarColors(patientAvatarColor(cp.id));
  const cpInitials = patientInitials(cp.name);
  const upcomingPreview = upcomingMeetings.slice(0, UPCOMING_PREVIEW);
  const hasMoreUpcoming = upcomingMeetings.length > UPCOMING_PREVIEW;

  const cpNext = upcomingMeetings[0] ?? null;
  const cpNextLabel = cpNext ? ('הפגישה הבאה · ' + formatMeetingWhen(new Date(cpNext.start))) : '';
  const openMeetingDetail = (event: CalendarUiEvent) =>
    set({ dialog: 'calEvent', calEventDetail: toCalEventDetail(event, meetingPatientId) });
  const deleteMeeting = (event: CalendarUiEvent) =>
    set({
      dialog: 'delMeeting',
      dialogMeetingId: event.id,
      dialogMeetingLabel: event.title + ' · ' + formatMeetingWhen(new Date(event.start)),
    });

  const defaultNotes = () => 'מטופל בטיפול. מוטיבציה גבוהה ושיתוף פעולה. הומלץ על המשך מעקב שבועי ועבודה על כלי ויסות.';
  const cpNotes = S.notesOverrides[cp.id] !== undefined ? S.notesOverrides[cp.id] : defaultNotes();

  // When wired to a backend, load this patient's stored clinical note into the
  // store so both this page and the letter reflect it (demo mode keeps the local
  // note). Skips while the user is mid-edit so it never clobbers a draft.
  const apiMode = isApiConfigured();
  useEffect(() => {
    if (!apiMode || !cp.id || S.editingNotes) return undefined;
    const ac = new AbortController();
    fetchPatientNote(cp.id, ac.signal)
      .then((n) => { if (n.body) set((s: any) => ({ notesOverrides: { ...s.notesOverrides, [cp.id]: n.body } })); })
      .catch(() => { /* keep the local/default note */ });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMode, cp.id]);

  const cpInfo = [
    { k: 'טלפון', v: cp.phone, dir: 'ltr' as const },
    { k: 'דוא״ל', v: displayPatientEmail(cp.email), dir: 'ltr' as const },
    { k: 'מאז', v: formatPatientSince(cp.created_at), dir: 'ltr' as const },
  ];

  const allHistory = buildPatientSessions(cp, S.deletedSessions || [], { navigate, set });
  const historyPreview = enrichPatientSessions(allHistory.slice(0, HISTORY_PREVIEW), S, cp.id);
  const hasMoreHistory = allHistory.length > HISTORY_PREVIEW;

  const clearNotesDraft = (extra: Record<string, any> = {}) => {
    const d = { ...S.notesDrafts }; delete d[cp.id];
    set({ notesDrafts: d, ...extra });
  };
  const startEditNotes = () => set({ editingNotes: true, notesDraft: cpNotes });
  const onNotesDraft = (e: any) => set({ notesDraft: e.target.value, notesDrafts: { ...S.notesDrafts, [cp.id]: e.target.value } });
  const saveNotes = () => {
    const d = { ...S.notesDrafts }; delete d[cp.id];
    const body = S.notesDraft;
    set({ notesOverrides: { ...S.notesOverrides, [cp.id]: body }, editingNotes: false, notesDrafts: d });
    if (apiMode) savePatientNote(cp.id, body).catch(() => { /* optimistic; UI already updated */ });
    toast('ההערות הקליניות נשמרו');
  };
  const cancelNotes = () => clearNotesDraft({ editingNotes: false });
  const recoveredNotes = S.notesDrafts[cp.id];
  const hasRecoverableNotes = !S.editingNotes && recoveredNotes != null && recoveredNotes.trim() !== '' && recoveredNotes !== cpNotes;
  const resumeNotesDraft = () => set({ editingNotes: true, notesDraft: recoveredNotes });
  const discardNotesDraft = () => { clearNotesDraft(); toast('הטיוטה נמחקה', 'info'); };

  const openUploadScreen = () => set({ route: 'upload', upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  const scheduleForPatient = () => set({ dialog: 'schedule', apptForm: defaultScheduleForm(meetingPatientId), errors: {} });
  const goReportFromPatient = () => navigate('report', { patientId: cp.id });
  const goMeetingHistory = () => navigate('meetingHistory', { patientId: S.patientId });
  const goUpcomingMeetings = () => navigate('upcomingMeetings', { patientId: S.patientId });
  const goPatients = () => navigate('patients');
  const deletePatientPermanent = () => set({ dialog: 'deletePatientPermanent', dialogPatientId: cp.id });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <a onClick={goPatients} role="button" tabIndex={0} className="pd-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>מטופלים</a>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{cp.name}</span>
      </div>

      {S.loading && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26, marginBottom: 20, display: 'flex', gap: 18, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 74, height: 74, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: 180, height: 18, borderRadius: 6, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 280, height: 13, borderRadius: 6 }} />
          </div>
        </div>
      )}

      {!S.loading && (
        <div>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: '24px 26px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', background: cpa.bg, color: cpa.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 26 }}>{cpInitials}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{cp.name}</h1>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5 }}>{cp.phone} · {displayPatientEmail(cp.email)}</p>
              <div style={{ marginTop: 9 }}>
                {meetingsLoading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" /></svg>
                    טוען פגישות…
                  </span>
                ) : cpNext ? (
                  <a onClick={() => openMeetingDetail(cpNext)} role="button" tabIndex={0} className="pd-next" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20, background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', color: 'var(--primary)', cursor: 'pointer' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" /></svg>
                    {cpNextLabel}
                  </a>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" /></svg>
                    אין פגישה מתוכננת
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={openUploadScreen} className="pd-primary-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--paper)"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></svg>העלאת הקלטה
              </button>
              <button onClick={scheduleForPatient} className="pd-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7zm4-7h2v2h-2z" /></svg>קביעת פגישה
              </button>
              <button onClick={goReportFromPatient} className="pd-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>דוח הכנה</button>
            </div>
          </div>

          <div className="rx-side" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 20 }}>
                <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>פרטי מטופל</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {cpInfo.map((i) => (
                    <div key={i.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{i.k}</span>
                      <span dir={i.dir} style={{ fontWeight: 600, color: 'var(--text)' }}>{i.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>הערות קליניות</h2>
                  {S.editingNotes ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={saveNotes} style={{ height: 30, padding: '0 12px', border: 'none', borderRadius: 7, background: 'var(--primary)', color: 'var(--paper)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>שמירה</button>
                      <button onClick={cancelNotes} style={{ height: 30, padding: '0 12px', border: '1px solid var(--border-input)', borderRadius: 7, background: 'var(--paper)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>ביטול</button>
                    </div>
                  ) : (
                    <svg onClick={startEditNotes} viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)" style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="עריכת הערות קליניות"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" /></svg>
                  )}
                </div>
                {hasRecoverableNotes && (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', borderRadius: 9, padding: '10px 12px', marginBottom: 12 }}>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--primary)" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z" /></svg>
                    <span style={{ flex: 1, minWidth: 130, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>יש טיוטה שלא נשמרה מעריכה קודמת. להמשיך?</span>
                    <button onClick={resumeNotesDraft} style={{ height: 30, padding: '0 12px', border: 'none', borderRadius: 7, background: 'var(--primary)', color: 'var(--paper)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>המשך עריכה</button>
                    <button onClick={discardNotesDraft} style={{ height: 30, padding: '0 10px', border: '1px solid var(--border-input)', borderRadius: 7, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>מחיקת הטיוטה</button>
                  </div>
                )}
                {S.editingNotes ? (
                  <textarea onChange={onNotesDraft} value={S.notesDraft} aria-label="הערות קליניות" className="pd-notes-ta" style={{ width: '100%', minHeight: 110, border: '1.5px solid var(--primary-border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, lineHeight: 1.7, outline: 'none', resize: 'vertical', fontFamily: 'inherit', color: 'var(--text)' }} />
                ) : (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>{cpNotes}</p>
                )}
              </div>

              <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 20 }}>
                <button
                  type="button"
                  onClick={deletePatientPermanent}
                  aria-label="מחיקת מטופל לצמיתות"
                  className="pd-danger-btn"
                  style={{
                    width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    border: '1px solid var(--error-border, var(--error))', borderRadius: 10, background: 'var(--paper)',
                    color: 'var(--error)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                  מחיקת מטופל לצמיתות
                </button>
                <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>כל הנתונים יימחקו · לא ניתן לשחזר</p>
              </div>
            </div>

            <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--bg)' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>פגישות</h2>
              </div>
              <div style={{ padding: '0 22px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text-secondary)' }}>פגישות קרובות</h3>
                  {hasMoreUpcoming && (
                    <a onClick={goUpcomingMeetings} role="button" tabIndex={0} className="pd-upcoming-link" style={{ fontSize: 13.5, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>כל הפגישות הקרובות ›</a>
                  )}
                </div>
                {meetingsLoading ? (
                  <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>טוען פגישות…</div>
                ) : (
                  <UpcomingMeetingList meetings={upcomingPreview} onSelect={openMeetingDetail} onDelete={deleteMeeting} />
                )}
              </div>

              <div style={{ padding: '12px 22px 18px', borderTop: '1px solid var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text-secondary)' }}>היסטוריית פגישות</h3>
                  {hasMoreHistory && (
                    <a onClick={goMeetingHistory} role="button" tabIndex={0} className="pd-history-link" style={{ fontSize: 13.5, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>כל ההיסטוריה ›</a>
                  )}
                </div>
                <PatientSessionList sessions={historyPreview} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
