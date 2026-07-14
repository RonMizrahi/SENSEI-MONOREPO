// Upload / record session audio — file pick, drag&drop, or in-browser recording.
// Offline recordings are queued in IndexedDB and synced when connectivity returns.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppStore';
import { validateFile } from '../utils';
import { submitUpload, usesMockUploadPipeline } from '../services/upload';
import { countPendingUploads } from '../services/uploadQueue';
import { useAudioRecorder, formatElapsed } from '../hooks/useAudioRecorder';
import { dbEventApiId, dayKey, fetchDbCalendarEvents, type CalendarUiEvent } from '../services/calendar';
import { isApiConfigured } from '../services/apiClient';
import { SESSION_DATES } from '../data/sessions';
import './upload.css';
import { CARD_SHADOW } from '../utils/styles';

const BAD_FORMAT = 'סוג הקובץ אינו נתמך. אנא העלו קובץ בפורמט MP3, WAV או M4A.';

const PRIVACY_POINTS = [
  { icon: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z', text: 'מוצפן בהעברה ובאחסון (AES-256)' },
  { icon: 'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z', text: 'ניקוי פרטים מזהים (PII) לפני ניתוח ה-AI' },
  { icon: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z', text: 'קובץ האודיו נמחק אוטומטית לאחר התמלול' },
  { icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', text: 'גישה מבוקרת. רק אתם רואים את המטופלים שלכם' },
];

type InputMode = 'file' | 'record';

function formatMeetingDateOption(e: CalendarUiEvent): string {
  const d = e.start;
  const datePart =
    String(d.getDate()).padStart(2, '0') + '.' +
    String(d.getMonth() + 1).padStart(2, '0') + '.' +
    d.getFullYear();
  const timePart =
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
  return datePart + ' · ' + timePart;
}

function isPastOrStartedMeeting(e: CalendarUiEvent, now = new Date()): boolean {
  return e.start.getTime() <= now.getTime();
}

export default function UploadPage() {
  const { S, set, navigate, toast } = useApp();
  const abortRef = useRef<AbortController | null>(null);
  const mockUpload = usesMockUploadPipeline();
  const apiMode = isApiConfigured();
  const recorder = useAudioRecorder({ mock: mockUpload });
  const inputMode: InputMode = S.uploadInputMode === 'record' ? 'record' : 'file';
  const [patientMeetings, setPatientMeetings] = useState<CalendarUiEvent[]>([]);
  const [uploadMeetingId, setUploadMeetingId] = useState('');

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const u = S.upload;
  const uploadDrop = u.state === 'idle' || u.state === 'dragging';
  const uploadBusy = u.state === 'uploading';
  const uploadQueued = u.state === 'queued';
  const uploadDone = u.state === 'success';
  const uploadFailed = u.state === 'error';
  const uploadProgress = u.progress;
  const uploadFileName = u.fileName || 'recording.mp3';
  const isOffline = S.online === false;

  const dropBorder = u.state === 'dragging' ? 'var(--primary)' : 'var(--border-input)';
  const dropBg = u.state === 'dragging' ? 'var(--primary-tint)' : 'var(--surface)';
  const uploadPid = S.uploadPatientId || S.patientId || (S.patients[0] && S.patients[0].id) || '';

  useEffect(() => {
    if (!uploadPid) {
      setPatientMeetings([]);
      setUploadMeetingId('');
      return undefined;
    }

    if (!apiMode) {
      // Demo seed: past session dates for the selected patient (no calendar API).
      const patient = (S.patients || []).find((p: any) => p.id === uploadPid);
      const count = patient ? Math.min(8, Math.max(3, Number(patient.sessions) || 6)) : 6;
      const demo: CalendarUiEvent[] = SESSION_DATES.slice(0, count).map((dateLabel, i) => {
        const [dd, mm, yyyy] = dateLabel.split('.').map(Number);
        const start = new Date(yyyy, mm - 1, dd, 9, 0, 0, 0);
        const end = new Date(start.getTime() + 50 * 60_000);
        return {
          id: 'demo-' + uploadPid + '-' + (count - i),
          title: patient?.name || 'פגישה',
          description: '',
          location: '',
          htmlLink: '',
          meetLink: '',
          allDay: false,
          start,
          end,
          status: 'confirmed',
          attendees: [],
          source: 'fixture' as const,
          patientId: uploadPid,
        };
      }).filter((e) => isPastOrStartedMeeting(e));
      setPatientMeetings(demo);
      setUploadMeetingId(demo[0]?.id || '');
      return undefined;
    }

    const ac = new AbortController();
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    fetchDbCalendarEvents(from, ac.signal, undefined, to)
      .then((events) => {
        const past = events
          .filter((e) => e.patientId === uploadPid)
          .filter((e) => isPastOrStartedMeeting(e))
          .sort((a, b) => +b.start - +a.start);
        setPatientMeetings(past);
        setUploadMeetingId((prev) => {
          if (prev && past.some((e) => dbEventApiId(e.id) === prev)) return prev;
          return past[0] ? dbEventApiId(past[0].id) : '';
        });
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setPatientMeetings([]);
          setUploadMeetingId('');
        }
      });
    return () => ac.abort();
  }, [apiMode, uploadPid, S.patients]);

  const selectedMeeting = patientMeetings.find((e) => {
    const id = apiMode ? dbEventApiId(e.id) : e.id;
    return id === uploadMeetingId;
  });

  const _up = u.progress;
  const _activeStage = u.state === 'success' ? 5 : _up < 20 ? 1 : _up < 55 ? 2 : _up < 100 ? 3 : 4;
  const uploadStages = ['העלאת הקובץ', 'תמלול בעברית', 'ניתוח AI', 'סיכום מוכן'].map((label, i) => {
    const n = i + 1;
    const status = n < _activeStage ? 'done' : n === _activeStage ? 'active' : 'pending';
    return {
      label, num: String(n), done: status === 'done', active: status === 'active', pending: status === 'pending',
      circleBg: status === 'done' ? 'var(--primary)' : status === 'active' ? 'var(--primary-tint)' : 'var(--surface-2)',
      labelColor: status === 'pending' ? 'var(--text-muted)' : 'var(--text-2)', labelWeight: status === 'active' ? 700 : 600,
      lineBg: n < _activeStage ? 'var(--primary)' : 'var(--divider)', showLine: n < 4,
    };
  });
  const uploadStageCaption = _activeStage === 1 ? 'מעלה את הקובץ…' : _activeStage === 2 ? 'מתמלל בעברית (Whisper)…' : 'מנתח עם AI…';

  const refreshPendingCount = () => {
    countPendingUploads().then((n) => set({ pendingUploadCount: n }));
  };

  const runUpload = async (file: File) => {
    if (apiMode && !uploadMeetingId) {
      set({ upload: { state: 'error', progress: 0, fileName: file.name, error: 'נא לבחור פגישה מהיומן לפני ההעלאה' } });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    set({ upload: { state: 'uploading', progress: 0, fileName: file.name, error: '' } });
    try {
      const result = await submitUpload(file, {
        patientId: uploadPid,
        meetingId: uploadMeetingId || undefined,
        sessionDate: selectedMeeting ? dayKey(selectedMeeting.start) : undefined,
        online: S.online !== false,
        onProgress: (p) => set((s: any) => ({ upload: { ...s.upload, progress: p } })),
        signal: ac.signal,
      });
      if (result.status === 'queued') {
        refreshPendingCount();
        set({ upload: { state: 'queued', progress: 0, fileName: file.name, error: '' } });
        toast('ההקלטה נשמרה מקומית · תועלה עם חזרת החיבור', 'info');
        return;
      }
      const t = result.transcript;
      const pid = uploadPid || S.patientId || S.activeTranscriptPatientId || '';
      if (t && typeof t.text === 'string' && pid) {
        const text = t.text.trim() || 'לא זוהה דיבור בהקלטה.';
        set((s: any) => ({
          transcriptsByPatient: {
            ...(s.transcriptsByPatient || {}),
            [pid]: {
              audioId: result.audioId || '',
              text,
              language: t.language || 'he',
              createdAt: new Date().toISOString(),
              meetingId: t.meetingId || uploadMeetingId,
              transcriptId: t.transcriptId,
            },
          },
          activeTranscriptPatientId: pid,
          patientId: pid,
          uploadPatientId: pid,
          upload: { state: 'success', progress: 100, fileName: file.name, error: '' },
          hasUploaded: true,
        }));
        navigate('transcript', { patientId: pid });
        toast('התמלול מוכן', 'success');
        return;
      }
      set({ upload: { state: 'success', progress: 100, fileName: file.name, error: '' }, hasUploaded: true });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      set({ upload: { state: 'error', progress: 0, fileName: file.name, error: e?.message || 'ההעלאה נכשלה. נסו שוב.' } });
    }
  };

  const onUploadFile = (file: File | undefined) => {
    if (!file) return;
    if (!validateFile(file.name)) {
      set({ upload: { state: 'error', progress: 0, fileName: file.name, error: BAD_FORMAT } });
      return;
    }
    runUpload(file);
  };

  const onDragOver = (e: any) => { e.preventDefault(); set({ upload: { ...S.upload, state: 'dragging' } }); };
  const onDragLeave = (e: any) => { e.preventDefault(); set({ upload: { ...S.upload, state: 'idle' } }); };
  const onDrop = (e: any) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onUploadFile(f); else runUpload(new File(['x'], 'פגישה_22-06.mp3', { type: 'audio/mpeg' }));
  };
  const pickFile = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.mp3,.wav,.m4a,.webm,.ogg,audio/*';
    inp.onchange = (e: any) => onUploadFile(e.target.files[0]);
    inp.click();
  };
  const simulateBad = () => set({ upload: { state: 'error', progress: 0, fileName: 'video.mp4', error: BAD_FORMAT } });
  const resetUpload = () => {
    abortRef.current?.abort();
    recorder.reset();
    set({ upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  };
  const cancelUpload = () => {
    abortRef.current?.abort();
    resetUpload();
    toast('ההעלאה בוטלה', 'info');
  };
  const setInputMode = (mode: InputMode) => {
    if (recorder.status === 'recording') recorder.cancel();
    set({ uploadInputMode: mode, upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  };
  const finishRecording = async () => {
    const file = await recorder.stop();
    if (file) onUploadFile(file);
  };

  const goSummaryFromUpload = () => navigate('summary', { patientId: S.uploadPatientId || S.patientId });
  const goTranscriptFromUpload = () => navigate('transcript', { patientId: S.uploadPatientId || S.patientId || S.activeTranscriptPatientId });
  const openHelp = () => navigate('help');

  const tabStyle = (active: boolean) => ({
    flex: 1, height: 42, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    background: active ? 'var(--primary)' : 'var(--surface-2)',
    color: active ? 'var(--paper)' : 'var(--text-2)',
  });

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>העלאה והקלטת פגישה</h1>
      <p style={{ margin: '0 0 22px', color: 'var(--text-secondary)', fontSize: 15 }}>
        העלו קובץ או הקליטו ישירות מהמחשב. ההקלטה תתומלל ותנותח אוטומטית.
        {isOffline && ' · אין חיבור · ההקלטות יישמרו מקומית עד לסנכרון.'}
      </p>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 24 }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>מטופל</label>
            <select aria-label="בחירת מטופל להעלאה" value={uploadPid} onChange={(e) => set({ uploadPatientId: e.target.value })} style={{ width: '100%', height: 44, border: '1px solid var(--border-input)', borderRadius: 10, padding: '0 12px', fontSize: 14.5, background: 'var(--paper)', outline: 'none', cursor: 'pointer', color: 'var(--text)' }}>
              {S.patients.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div style={{ flex: 1.4, minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>תאריך הפגישה</label>
            <select
              aria-label="בחירת תאריך פגישה"
              value={uploadMeetingId}
              onChange={(e) => setUploadMeetingId(e.target.value)}
              dir="ltr"
              style={{ width: '100%', height: 44, border: '1px solid var(--border-input)', borderRadius: 10, padding: '0 12px', fontSize: 14.5, background: 'var(--paper)', outline: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'start' }}
            >
              {patientMeetings.length === 0 && (
                <option value="">אין פגישות קודמות למטופל זה</option>
              )}
              {patientMeetings.map((e) => {
                const value = apiMode ? dbEventApiId(e.id) : e.id;
                return (
                  <option key={e.id} value={value}>{formatMeetingDateOption(e)}</option>
                );
              })}
            </select>
          </div>
        </div>

        {uploadDrop && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => setInputMode('file')} style={tabStyle(inputMode === 'file')}>העלאת קובץ</button>
            <button type="button" onClick={() => setInputMode('record')} style={tabStyle(inputMode === 'record')}>הקלטה ישירה</button>
          </div>
        )}

        {/* file upload */}
        {uploadDrop && inputMode === 'file' && (<>
          <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{ border: '2px dashed ' + dropBorder, borderRadius: 10, background: dropBg, padding: '46px 20px', textAlign: 'center', transition: 'all .15s' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg viewBox="0 0 24 24" width="34" height="34" fill="var(--primary)"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></svg>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>גררו קובץ לכאן או בחרו מהמחשב</h2>
            <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>פורמטים נתמכים: MP3, WAV, M4A · עד 200MB</p>
            <button onClick={pickFile} style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>בחירת קובץ</button>
            {S.demoMode && <div style={{ marginTop: 14 }}><a onClick={simulateBad} className="upl-demo-link" style={{ fontSize: 12.5, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>הדגמת שגיאת פורמט</a></div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, fontSize: 12.5, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>מה קורה אחרי ההעלאה:</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }}></span>תמלול אוטומטי</span>
            <span style={{ color: 'var(--text-disabled)' }}>›</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }}></span>ניתוח AI</span>
            <span style={{ color: 'var(--text-disabled)' }}>›</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }}></span>סיכום מוכן לבדיקה</span>
            <span style={{ color: 'var(--text-muted)' }}>· כ-2 דק׳</span>
          </div>
        </>)}

        {/* in-browser recording */}
        {uploadDrop && inputMode === 'record' && (
          <div style={{ border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--surface)', padding: '36px 20px', textAlign: 'center' }}>
            {isOffline && (
              <div role="status" style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 8, background: 'var(--warning-bg)', color: 'var(--warning-strong)', fontSize: 13, fontWeight: 600 }}>
                אין חיבור · ההקלטה תישמר במכשיר ותועלה אוטומטית עם חזרת האינטרנט
              </div>
            )}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 18px',
              background: recorder.status === 'recording' ? 'var(--error-bg)' : 'var(--primary-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recorder.status === 'recording' ? '0 0 0 8px rgba(220,38,38,.12)' : 'none',
              animation: recorder.status === 'recording' ? 'pulse 1.4s ease-in-out infinite' : 'none',
            }}>
              <svg viewBox="0 0 24 24" width="38" height="38" fill={recorder.status === 'recording' ? 'var(--error)' : 'var(--primary)'}>
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
            {recorder.status === 'idle' && (
              <>
                <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>הקליטו את הפגישה ישירות</h2>
                <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
                  {recorder.mock
                    ? 'מצב הדגמה · ההקלטה מדמה קובץ לדוגמה (ללא מיקרופון)'
                    : recorder.supported
                      ? 'לחצו להתחלה · נדרשת הרשאת מיקרופון'
                      : 'הדפדפן שלכם לא תומך בהקלטה. השתמשו בהעלאת קובץ.'}
                </p>
                <button
                  onClick={() => recorder.start()}
                  disabled={!recorder.supported}
                  aria-label="התחלת הקלטה"
                  style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: recorder.supported ? 'pointer' : 'default', opacity: recorder.supported ? 1 : 0.5 }}
                >
                  התחלת הקלטה
                </button>
              </>
            )}
            {recorder.status === 'recording' && (
              <>
                <div aria-live="polite" dir="ltr" style={{ fontSize: 32, fontWeight: 800, letterSpacing: 2, marginBottom: 8, color: 'var(--error)' }}>{formatElapsed(recorder.elapsed)}</div>
                <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>מקליט… לחצו סיום כשהפגישה נגמרת</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={finishRecording} aria-label="סיום הקלטה" style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>סיום והמשך</button>
                  <button onClick={() => recorder.cancel()} aria-label="ביטול הקלטה" style={{ height: 44, padding: '0 22px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>ביטול</button>
                </div>
              </>
            )}
            {(recorder.status === 'error' || recorder.error) && (
              <p role="alert" style={{ margin: '12px 0 0', color: 'var(--error)', fontSize: 14 }}>{recorder.error}</p>
            )}
          </div>
        )}

        {/* uploading */}
        {uploadBusy && (
          <div style={{ border: '1px solid var(--primary-border)', borderRadius: 10, background: 'var(--primary-surface)', padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--primary)"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div dir="ltr" style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' }}>{uploadFileName}</div>
                <div aria-live="polite" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{uploadStageCaption} · {uploadProgress}%</div>
              </div>
              <div aria-hidden="true" style={{ width: 22, height: 22, border: '3px solid var(--primary-border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .8s linear infinite' }}></div>
              <button onClick={cancelUpload} aria-label="ביטול ההעלאה" style={{ height: 36, padding: '0 14px', border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--paper)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0 }}>ביטול</button>
            </div>
            <div role="progressbar" aria-label="התקדמות העיבוד" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} style={{ height: 8, borderRadius: 6, background: 'var(--primary-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 6, width: uploadProgress + '%', transition: 'width .2s' }}></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: '8px 0' }}>
              {uploadStages.map((st) => (
                <div key={st.num} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: st.circleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {st.done && (<svg viewBox="0 0 24 24" width="15" height="15" fill="var(--on-accent)"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>)}
                      {st.active && (<div style={{ width: 13, height: 13, border: '2px solid var(--primary-border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .8s linear infinite' }}></div>)}
                      {st.pending && (<span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>{st.num}</span>)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: st.labelWeight, color: st.labelColor, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </div>
                  {st.showLine && (<div style={{ width: 22, height: 2, background: st.lineBg, margin: '0 9px', flexShrink: 0 }}></div>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* queued offline */}
        {uploadQueued && (
          <div role="status" style={{ border: '1px solid var(--warning-strong)', borderRadius: 10, background: 'var(--warning-bg)', padding: '34px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg viewBox="0 0 24 24" width="34" height="34" fill="var(--warning-strong)"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" /></svg>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>נשמרה להעלאה מאוחרת</h2>
            <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: 14.5 }}>
              <span dir="ltr">{uploadFileName}</span> · ההקלטה נשמרה במכשיר
            </p>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              {S.pendingUploadCount > 1
                ? `${S.pendingUploadCount} הקלטות ממתינות לסנכרון`
                : 'תועלה ותעובד אוטומטית עם חזרת החיבור'}
            </p>
            <button onClick={resetUpload} style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>הקלטה נוספת</button>
          </div>
        )}

        {/* success */}
        {uploadDone && (
          <div role="status" style={{ border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--paper)', padding: '34px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'pop .3s ease' }}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--success)"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>ההקלטה עובדה בהצלחה</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14.5 }}>התמלול מוכן לצפייה.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={goTranscriptFromUpload} style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>צפייה בתמלול</button>
              <button onClick={goSummaryFromUpload} style={{ height: 44, padding: '0 20px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>סיכום</button>
              <button onClick={resetUpload} style={{ height: 44, padding: '0 20px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>העלאה נוספת</button>
            </div>
          </div>
        )}

        {/* error */}
        {uploadFailed && (
          <div role="alert" style={{ border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--paper)', padding: '34px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg viewBox="0 0 24 24" width="34" height="34" fill="var(--error)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>ההעלאה נכשלה</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14.5 }}>{u.error}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={resetUpload} style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>נסו שוב</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--success)"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" /></svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>ההקלטה שלכם מאובטחת</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 18px' }}>
            {PRIVACY_POINTS.map((pp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--success)" style={{ flexShrink: 0, marginTop: 1 }}><path d={pp.icon} /></svg>
                <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{pp.text}</span>
              </div>
            ))}
          </div>
          <a onClick={openHelp} className="upl-policy-link" style={{ display: 'inline-block', marginTop: 13, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>מדיניות הפרטיות והאבטחה המלאה ›</a>
        </div>
      </div>
    </div>
  );
}
