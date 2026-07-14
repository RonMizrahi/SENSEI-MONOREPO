// Summary — live Ollama summary when API + meetingId; mock copy offline.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppStore';
import { CARD_SHADOW } from '../utils/styles';
import { getPatient, hg } from '../utils';
import { isApiConfigured } from '../services/apiClient';
import {
  pollMeetingSummary,
  type MeetingSummary,
} from '../services/meetingSummary';
import { parseSummaryContent } from '../services/summaryDisplay';
import './summary.css';

const MOCK_TOPICS = ['חרדת ביצוע במצבים חברתיים-מקצועיים', 'הפרעות שינה סביב אירועים מלחיצים', 'שימוש מוצלח בכלי ויסות עצמי', 'תחושת מסוגלות וגאווה לאחר התמודדות'];
const MOCK_PATTERNS = ['מחשבות קטסטרופליות לפני אירועים מאתגרים', 'ספירלת חרדה גופנית-מחשבתית מתעצמת', 'נטייה לצפות מראש לכישלון למרות הצלחות'];
const MOCK_RISK_FLAGS = [
  { level: 'נמוך', color: 'var(--success)', bg: 'var(--success-bg)', text: 'לחץ נקודתי סביב אירוע ספציפי, ללא סימני מצוקה כללית. מגמה חיובית.' },
  { level: 'לתשומת לב', color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'חשש מצבי עתידי שעשוי להזין דפוסי הימנעות. כדאי להמשיך לעקוב.' },
];

export default function SummaryPage() {
  const { S, set, navigate, toast } = useApp();

  const cp = getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const stored = (S.transcriptsByPatient && S.transcriptsByPatient[cp.id]) || null;
  const meetingId = stored?.meetingId ? String(stored.meetingId) : '';
  const useApi = isApiConfigured() && !!meetingId;

  const [apiSummary, setApiSummary] = useState<MeetingSummary | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!useApi) {
      setApiSummary(null);
      setApiError('');
      setApiLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    setApiLoading(true);
    setApiError('');
    setApiSummary(null);
    pollMeetingSummary(meetingId, {
      signal: ac.signal,
      onUpdate: (s) => setApiSummary(s),
    })
      .then((s) => {
        setApiSummary(s);
        if (s.status === 'failed') {
          setApiError(s.error || 'יצירת הסיכום נכשלה');
        }
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError' || ac.signal.aborted) return;
        setApiError(
          (typeof e?.details?.detail === 'string' && e.details.detail)
          || e?.message
          || 'לא ניתן לטעון את הסיכום',
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setApiLoading(false);
      });
    return () => ac.abort();
  }, [useApi, meetingId]);

  const goPatientFromSub = () => navigate('patient', { patientId: S.patientId });
  const goTranscriptFromSub = () => navigate('transcript', { patientId: S.patientId });
  const goLetter = () => navigate('letter', { patientId: S.patientId });

  // ---- human-in-the-loop correction ----
  const transcriptExcerpt = stored && typeof stored.text === 'string'
    ? stored.text.trim().slice(0, 400)
    : '';
  const demoSummary = 'הפגישה התמקדה בהתמודדות עם חרדת ביצוע סביב אירוע משמעותי בעבודה. ' + cp.name.split(' ')[0] + hg(' [[תיאר|תיארה]] קושי בשינה בימים שקדמו לאירוע, לצד מחשבות קטסטרופליות לגבי כישלון אפשרי. במהלך הפגישה זוהתה התקדמות חשובה: שימוש עצמאי ומוצלח בטכניקת הנשימה הסרעפתית שנלמדה, שהוביל לתחושת מסוגלות וגאווה. עם זאת, עלה חשש מצבי עתידי. הומלץ על המשך חיזוק חוויות ההצלחה והרחבת החשיפה ההדרגתית.');
  const fallbackAiSummary = transcriptExcerpt
    ? ('מבוסס תמלול: ' + transcriptExcerpt + ((stored?.text?.trim().length || 0) > 400 ? '…' : ''))
    : demoSummary;

  const liveText = apiSummary?.status === 'ready' ? (apiSummary.text || '') : '';
  const parsedLive = useMemo(
    () => (useApi && liveText ? parseSummaryContent(liveText) : null),
    [useApi, liveText],
  );
  const aiSummary = useApi && parsedLive
    ? parsedLive.displayText
    : (useApi && liveText ? liveText : fallbackAiSummary);

  const sumEdited = S.summaryEdits[cp.id];
  const summaryText = sumEdited != null ? sumEdited : aiSummary;
  const summaryEdited = sumEdited != null;
  const editingSummary = S.editingSummary;
  const notEditingSummary = !S.editingSummary;
  const summaryEditedByLabel = hg('נערך על ידי [[המטפל|המטפלת]]', S.profile.gender);

  const clearDraft = (extra: Record<string, any> = {}) => {
    const d = { ...S.summaryDrafts }; delete d[cp.id];
    set({ summaryDrafts: d, ...extra });
  };
  const onSummaryDraft = (e: any) => set({ summaryDraft: e.target.value, summaryDrafts: { ...S.summaryDrafts, [cp.id]: e.target.value } });
  const startEditSummary = () => set({ editingSummary: true, summaryDraft: summaryText });
  const cancelEditSummary = () => clearDraft({ editingSummary: false });
  const saveSummary = () => {
    const txt = (S.summaryDraft || '').trim(); if (!txt) return;
    const d = { ...S.summaryDrafts }; delete d[cp.id];
    set({ summaryEdits: { ...S.summaryEdits, [cp.id]: txt }, editingSummary: false, summaryDrafts: d });
    toast('הסיכום עודכן ונשמר');
  };
  const restoreAISummary = () => {
    const m = { ...S.summaryEdits }; delete m[cp.id];
    const d = { ...S.summaryDrafts }; delete d[cp.id];
    set({ summaryEdits: m, editingSummary: false, summaryDrafts: d }); toast('שוחזרה גרסת ה-AI המקורית');
  };
  const recoveredDraft = S.summaryDrafts[cp.id];
  const hasRecoverableDraft = notEditingSummary && recoveredDraft != null && recoveredDraft.trim() !== '' && recoveredDraft !== summaryText;
  const resumeDraft = () => set({ editingSummary: true, summaryDraft: recoveredDraft });
  const discardDraft = () => { clearDraft(); toast('הטיוטה נמחקה', 'info'); };

  const mainTopics = useMemo(() => {
    if (parsedLive?.mainTopics?.length) return parsedLive.mainTopics;
    return MOCK_TOPICS;
  }, [parsedLive]);

  const patterns = useMemo(() => {
    if (!parsedLive) return MOCK_PATTERNS;
    const fromInterventions = parsedLive.interventions.filter(Boolean);
    if (fromInterventions.length) return fromInterventions;
    if (parsedLive.followUp.length) return parsedLive.followUp;
    return MOCK_PATTERNS;
  }, [parsedLive]);

  const riskFlags = useMemo(() => {
    if (parsedLive?.riskSigns) {
      const text = parsedLive.riskSigns;
      const low = /לא נאמרו|אין סימן|no risk|未明确|ไม่มี/i.test(text);
      return [{
        level: low ? 'נמוך' : 'לתשומת לב',
        color: low ? 'var(--success)' : 'var(--warning)',
        bg: low ? 'var(--success-bg)' : 'var(--warning-bg)',
        text,
      }];
    }
    return MOCK_RISK_FLAGS;
  }, [parsedLive]);

  const showSkeleton = (!useApi && S.loading)
    || (useApi && (apiLoading || apiSummary?.status === 'pending' || apiSummary?.status === 'running'));
  const showError = useApi && !apiLoading && (!!apiError || apiSummary?.status === 'failed');
  const showBody = !showSkeleton && !showError;

  const subtitle = useApi
    ? (apiSummary?.model
      ? `${cp.name} · נוצר ע״י ${apiSummary.model}`
      : `${cp.name} · סיכום מהתמלול`)
    : `${cp.name} · 22.06.2026 · נוצר אוטומטית לאחר ניקוי PII`;

  const retrySummary = () => {
    if (!meetingId) return;
    setApiLoading(true);
    setApiError('');
    pollMeetingSummary(meetingId, { onUpdate: setApiSummary })
      .then((s) => {
        setApiSummary(s);
        if (s.status === 'failed') setApiError(s.error || 'יצירת הסיכום נכשלה');
      })
      .catch((e: any) => {
        setApiError(typeof e?.details?.detail === 'string' ? e.details.detail : (e?.message || 'שגיאה'));
      })
      .finally(() => setApiLoading(false));
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <a onClick={goPatientFromSub} className="sum-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>{cp.name}</a>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>סיכום AI</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,var(--primary),var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--paper)"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" /></svg>
            </div>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: '-.5px' }}>סיכום פגישה</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5 }}>{subtitle}</p>
        </div>
        <button onClick={goTranscriptFromSub} className="sum-outline-btn" style={{ height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>צפייה בתמלול</button>
        <button onClick={goLetter} className="sum-outline-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" /></svg>מכתב קליני
        </button>
      </div>

      {isApiConfigured() && !meetingId && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-secondary)' }}>
            אין מזהה פגישה לתמלול זה · העלו הקלטה מחדש מהיומן כדי לייצר סיכום מודל.
          </p>
        </div>
      )}

      {showSkeleton && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26 }}>
          <div className="skeleton" style={{ width: '40%', height: 16, borderRadius: 6, background: 'linear-gradient(90deg,var(--skeleton-1) 25%,var(--skeleton-2) 37%,var(--skeleton-1) 63%)', backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', marginBottom: 16 }}></div>
          <div className="skeleton" style={{ width: '100%', height: 12, borderRadius: 6, background: 'linear-gradient(90deg,var(--skeleton-1) 25%,var(--skeleton-2) 37%,var(--skeleton-1) 63%)', backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', marginBottom: 9 }}></div>
          <div className="skeleton" style={{ width: '85%', height: 12, borderRadius: 6, background: 'linear-gradient(90deg,var(--skeleton-1) 25%,var(--skeleton-2) 37%,var(--skeleton-1) 63%)', backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear' }}></div>
          {useApi && (
            <p style={{ margin: '16px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>מייצרים סיכום עם המודל המקומי…</p>
          )}
        </div>
      )}

      {showError && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>לא ניתן להציג את הסיכום</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {apiError || apiSummary?.error || 'יצירת הסיכום נכשלה'}
          </p>
          <button
            type="button"
            onClick={() => { void retrySummary(); }}
            className="sum-primary-btn"
            style={{ height: 40, padding: '0 18px', border: 'none', borderRadius: 9, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            נסו שוב
          </button>
        </div>
      )}

      {showBody && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2z" /></svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>תקציר</h2>
              {summaryEdited && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'var(--secondary-bg)', color: 'var(--secondary-strong)' }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>{summaryEditedByLabel}
                </span>
              )}
              {notEditingSummary && (
                <button onClick={startEditSummary} className="sum-outline-btn" style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', border: '1px solid var(--border-input)', borderRadius: 9, background: 'var(--paper)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>עריכה
                </button>
              )}
            </div>
            {hasRecoverableDraft && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <svg viewBox="0 0 24 24" width="19" height="19" fill="var(--primary)" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z" /></svg>
                <span style={{ flex: 1, minWidth: 140, fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)' }}>יש טיוטה שלא נשמרה מעריכה קודמת. להמשיך מהמקום שהפסקתם?</span>
                <button onClick={resumeDraft} style={{ height: 34, padding: '0 15px', border: 'none', borderRadius: 9, background: 'var(--primary)', color: 'var(--paper)', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>המשך עריכה</button>
                <button onClick={discardDraft} style={{ height: 34, padding: '0 12px', border: '1px solid var(--border-input)', borderRadius: 9, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>מחיקת הטיוטה</button>
              </div>
            )}
            {notEditingSummary && (
              <>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{summaryText}</p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>מבוסס אך ורק על התמלול של פגישה זו. כלי עזר לתיעוד. אינו מהווה אבחון או המלצה קלינית, והאחריות המקצועית נותרת בידיכם.</span>
                </div>
                {summaryEdited && (
                  <a onClick={restoreAISummary} role="button" tabIndex={0} className="sum-restore" style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>↺ שחזור לגרסת ה-AI המקורית</a>
                )}
              </>
            )}
            {editingSummary && (
              <div>
                <textarea value={S.summaryDraft} onChange={onSummaryDraft} aria-label="עריכת תקציר הסיכום" style={{ width: '100%', minHeight: 150, border: '1.5px solid var(--primary)', borderRadius: 10, padding: '12px 14px', fontSize: 15, lineHeight: 1.75, color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}></textarea>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={saveSummary} className="sum-primary-btn" style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 9, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>שמירת השינויים</button>
                  <button onClick={cancelEditSummary} style={{ height: 40, padding: '0 18px', border: '1px solid var(--border-input)', borderRadius: 9, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>ביטול</button>
                </div>
              </div>
            )}
          </div>

          <div className="sum-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--secondary-strong)"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" /></svg>
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>נושאים מרכזיים</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {mainTopics.map((t) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: 'var(--text)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--secondary-strong)', flexShrink: 0 }}></span>{t}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--info)"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" /></svg>
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{useApi && liveText ? 'המשך / התערבויות' : 'דפוסים חוזרים'}</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {patterns.map((p) => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: 'var(--text)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--info)', flexShrink: 0 }}></span>{p}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '18px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--divider)' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--error)"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>דגלי סיכון</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginInlineStart: 4 }}>(אינדיקטור בלבד. אינו מהווה אבחנה רפואית)</span>
            </div>
            <div style={{ padding: '8px 24px 18px' }}>
              {riskFlags.map((rf, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--divider)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: rf.bg, color: rf.color, whiteSpace: 'nowrap', marginTop: 2 }}>{rf.level}</span>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--text)' }}>{rf.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
