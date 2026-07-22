// Full transcript — two-sided chat with in-transcript search + copy-to-clipboard.
// Ported from 'Sensei demo.dc.html' template lines 944–983 + renderVals
// (v.isTranscript). The seeded transcript, gendered speaker labels and the search
// filter are ported verbatim from the logic class; the search query stays in the
// store (S.transcriptSearch) as it did in this.state.
import { useApp } from '../store/AppStore';
import { getPatient, hg, hgTerm } from '../utils';
import { patientInitials } from '../services/patients';
import { hlParts } from '../utils/search';
import { downloadTextFile } from '../utils/download';
import './transcript.css';
import { CARD_SHADOW } from '../utils/styles';

const SHIMMER = 'linear-gradient(90deg,var(--skeleton-1) 25%,var(--skeleton-2) 37%,var(--skeleton-1) 63%)';
const skeletonRows = [1, 2, 3, 4, 5, 6];

export default function TranscriptPage() {
  const { S, set, navigate, copyToClipboard, toast } = useApp();

  const activePid = S.activeTranscriptPatientId || S.patientId;
  const cp = getPatient(S.patients, activePid, S.archivedPatients || []);
  // Prefer the most recent upload's transcript, then the current patient's.
  const stored =
    (S.activeTranscriptPatientId && S.transcriptsByPatient?.[S.activeTranscriptPatientId])
    || (S.transcriptsByPatient && S.transcriptsByPatient[cp.id])
    || null;
  const gTherapist = hgTerm('therapist', S.profile.gender);
  const gPatient = hgTerm('patient');

  // Real Whisper transcript from upload (client-persisted) — plain paragraphs.
  if (stored && typeof stored.text === 'string' && stored.text.trim() !== '') {
    const tq = S.transcriptSearch.trim();
    const rawLines = stored.text.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);
    const paragraphs = rawLines.length > 1
      ? rawLines
      : stored.text.split(/(?<=[.!?…])\s+/).map((s: string) => s.trim()).filter(Boolean);
    const lines = tq ? paragraphs.filter((l: string) => l.includes(tq)) : paragraphs;
    const matchLabel = lines.length + ' תוצאות';
    const fullText = stored.text;
    const copyStored = () => copyToClipboard(fullText, 'התמלול הועתק ללוח');
    const downloadStored = () => {
      downloadTextFile('תמלול-' + cp.name.replace(/\s+/g, '-') + '.txt', fullText);
      toast('התמלול הורד כקובץ טקסט', 'success');
    };
    const clearStoredSearch = () => set({ transcriptSearch: '' });
    const goPatientStored = () => navigate('patient', { patientId: cp.id });
    const goSummaryStored = () => navigate('summary', { patientId: cp.id });
    const onStoredSearch = (e: any) => set({ transcriptSearch: e.target.value });
    const deleteAndReupload = () => set({
      dialog: 'delTranscript',
      dialogTranscriptPatientId: cp.id,
      dialogMeetingId: stored.meetingId || S.meetingId || null,
    });

    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          <a onClick={goPatientStored} className="trs-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>{cp.name}</a>
          <span>›</span>
          <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>תמלול הפגישה</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 25, fontWeight: 800, letterSpacing: '-.5px' }}>תמלול מלא</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5 }}>
              {cp.name} · {stored.language || 'he'} · מתמלול Whisper
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={copyStored} className="trs-copy-btn" style={{ height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>העתקה</button>
            <button onClick={downloadStored} className="trs-copy-btn" style={{ height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>הורדה</button>
            <button onClick={deleteAndReupload} className="trs-copy-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: '1px solid var(--error)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--error-dark)' }}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              מחיקה והעלאה מחדש
            </button>
            <button onClick={goSummaryStored} style={{ height: 42, padding: '0 16px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>סיכום</button>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input value={S.transcriptSearch} onChange={onStoredSearch} aria-label="חיפוש בתמלול" placeholder="חיפוש בתמלול…" className="trs-search" style={{ width: '100%', height: 44, border: '1px solid var(--primary-border)', background: 'var(--primary-surface)', borderRadius: 10, padding: '0 14px', fontSize: 14.5, outline: 'none', color: 'var(--text)' }} />
          {!!tq && (<span style={{ position: 'absolute', insetInlineEnd: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{matchLabel}</span>)}
        </div>

        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22 }}>
          {lines.length === 0 && tq ? (
            <div role="status" style={{ textAlign: 'center', padding: '34px 20px' }}>
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)' }}>אין תוצאות לחיפוש</p>
              <button type="button" onClick={clearStoredSearch} style={{ height: 40, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer' }}>ניקוי החיפוש</button>
            </div>
          ) : (
            lines.map((l: string, i: number) => (
              <div key={i} style={{ padding: '12px 4px', borderTop: i === 0 ? 'none' : '1px solid var(--divider)', fontSize: 15.5, lineHeight: 1.65 }}>
                {tq ? hlParts(l, tq).map((part, j) => (
                  <span key={j} style={{ fontWeight: part.fw, background: part.bg }}>{part.t}</span>
                )) : l}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // seeded transcript — ported verbatim (gendered therapist line via HG fills)
  const T = [
    { sp: 'therapist', time: '00:12', text: 'אז ספרי לי איך עבר עליך השבוע מאז שנפגשנו בפעם הקודמת.' },
    { sp: 'patient', time: '00:21', text: 'היה שבוע די קשה האמת. הייתה לי הצגה גדולה בעבודה וכמה ימים לפני זה כמעט לא הצלחתי לישון.' },
    { sp: 'therapist', time: '00:38', text: hg('אני [[שומע|שומעת]]. מה עבר לך בראש בלילות האלה לפני ההצגה?', S.profile.gender) },
    { sp: 'patient', time: '00:49', text: 'כל הזמן דמיינתי שאני אתבלבל מול כולם, שכולם יראו שאני לחוצה. הלב שלי דפק חזק וזה רק החמיר את זה.' },
    { sp: 'therapist', time: '01:10', text: 'זה נשמע כמו אותה ספירלה שדיברנו עליה. תזכרי שתרגלנו נשימה סרעפתית בדיוק בשביל הרגעים האלה. הצלחת להשתמש בזה?' },
    { sp: 'patient', time: '01:25', text: 'ניסיתי בבוקר ההצגה וזה דווקא עזר קצת. הצלחתי להירגע מספיק כדי להתחיל.' },
    { sp: 'therapist', time: '01:40', text: 'זו התקדמות ממש משמעותית. השתמשת בכלי ברגע אמת והוא עבד. איך הרגשת אחרי שסיימת?' },
    { sp: 'patient', time: '01:55', text: 'הרגשתי הקלה ענקית, ואפילו קצת גאווה. אבל אחר כך התחלתי לפחד מהפעם הבאה.' },
    { sp: 'therapist', time: '02:14', text: 'בואי נתעכב על תחושת הגאווה הזו לרגע. היא חשובה. מה היא אומרת לך על היכולות שלך?' },
    { sp: 'patient', time: '02:28', text: 'שאולי אני מסוגלת יותר ממה שאני חושבת. שזה לא תמיד חייב להסתיים באסון.' },
  ];

  const tq = S.transcriptSearch.trim();
  const lines = tq ? T.filter((l) => l.text.includes(tq)) : T;
  const transcriptHasQuery = !!tq;
  const transcriptMatchLabel = lines.length + ' תוצאות';

  const transcriptLines = lines.map((l, i) => {
    const isT = l.sp === 'therapist';
    return {
      key: i, text: l.text, time: l.time,
      speaker: isT ? gTherapist : gPatient,
      tag: isT ? 'מ' : patientInitials(cp.name),
      av: isT ? 'var(--primary)' : 'var(--secondary)',
      nameColor: isT ? 'var(--primary)' : 'var(--secondary)',
      bubble: isT ? 'var(--primary-tint)' : 'var(--secondary-tint)',
      border: isT ? 'var(--primary-border)' : 'var(--secondary-border)',
      justify: isT ? 'flex-start' : 'flex-end',
    };
  });

  const transcriptText = () =>
    T.map((l) => (l.sp === 'therapist' ? gTherapist : gPatient) + ' [' + l.time + ']: ' + l.text).join('\n');
  const copyTranscript = () => copyToClipboard(transcriptText(), 'התמלול הועתק ללוח');
  // export as a plain-text file — a real frontend capability (Blob, no backend)
  const downloadTranscript = () => {
    downloadTextFile('תמלול-' + cp.name.replace(/\s+/g, '-') + '.txt', transcriptText());
    toast('התמלול הורד כקובץ טקסט', 'success');
  };
  const clearTranscriptSearch = () => set({ transcriptSearch: '' });
  const goPatientFromSub = () => navigate('patient', { patientId: S.patientId });
  const goSummaryFromSub = () => navigate('summary', { patientId: S.patientId });
  const onTranscriptSearch = (e: any) => set({ transcriptSearch: e.target.value });

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <a onClick={goPatientFromSub} className="trs-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>{cp.name}</a>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>תמלול הפגישה</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 25, fontWeight: 800, letterSpacing: '-.5px' }}>תמלול מלא</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5 }}>{cp.name} · פגישה אחרונה · 52 דק׳</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copyTranscript} className="trs-copy-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
            העתקה
          </button>
          <button onClick={downloadTranscript} className="trs-copy-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
            הורדה
          </button>
          <button onClick={goSummaryFromSub} style={{ height: 42, padding: '0 16px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>סיכום AI</button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="var(--text-muted)" style={{ position: 'absolute', insetInlineStart: 13, top: '50%', transform: 'translateY(-50%)' }}><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z" /></svg>
        <input value={S.transcriptSearch} onChange={onTranscriptSearch} aria-label="חיפוש בתמלול" placeholder="חיפוש בתמלול…" className="trs-search" style={{ width: '100%', height: 44, border: '1px solid var(--primary-border)', background: 'var(--primary-surface)', borderRadius: 10, padding: '0 42px 0 14px', fontSize: 14.5, outline: 'none', color: 'var(--text)' }} />
        {transcriptHasQuery && (<span style={{ position: 'absolute', insetInlineEnd: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{transcriptMatchLabel}</span>)}
      </div>

      <div style={{ display: 'flex', gap: 18, marginBottom: 14, fontSize: 13 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)'}}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--primary)' }}></span>{gTherapist}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--secondary)' }}></span>{gPatient}</span>
      </div>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {S.loading ? (
          skeletonRows.map((k) => (
            <div key={k} style={{ display: 'flex', gap: 12 }}>
              <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%', background: SHIMMER, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', flexShrink: 0 }}></div>
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '90%', height: 12, borderRadius: 6, background: SHIMMER, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', marginBottom: 7 }}></div>
                <div className="skeleton" style={{ width: '60%', height: 12, borderRadius: 6, background: SHIMMER, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear' }}></div>
              </div>
            </div>
          ))
        ) : transcriptLines.length === 0 && transcriptHasQuery ? (
          <div role="status" style={{ textAlign: 'center', padding: '34px 20px' }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="var(--text-muted)"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z" /></svg>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>אין תוצאות לחיפוש ״{tq}״</h2>
            <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>נסו מונח אחר או נקו את החיפוש כדי לחזור לתמלול המלא.</p>
            <button onClick={clearTranscriptSearch} style={{ height: 40, padding: '0 18px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>ניקוי החיפוש</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {transcriptLines.map((l) => (
              <div key={l.key} style={{ display: 'flex', gap: 12, flexDirection: 'row', justifyContent: l.justify }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: l.av, color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{l.tag}</div>
                <div style={{ maxWidth: '76%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, justifyContent: l.justify }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: l.nameColor }}>{l.speaker}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{l.time}</span>
                  </div>
                  <div style={{ background: l.bubble, border: '1px solid ' + l.border, borderRadius: 10, padding: '11px 14px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text)' }}>{tq ? hlParts(l.text, tq).map((np, i) => <span key={i} style={{ background: np.bg, fontWeight: np.fw, borderRadius: 3 }}>{np.t}</span>) : l.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
