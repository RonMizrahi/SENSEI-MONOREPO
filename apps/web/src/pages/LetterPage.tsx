// Clinical Letter — ported from 'Sensei demo.dc.html'
// (template lines 1173–1199 · logic: renderVals isLetter slice ~3630–3655).
import { useApp } from '../store/AppStore';
import { getPatient, hg } from '../utils';
import { formatPatientSince } from '../services/patients';
import { initials } from './settings/shared';
import ShareMenu from '../components/shared/ShareMenu';
import './letter.css';

export default function LetterPage() {
  const { S, navigate, copyToClipboard } = useApp();

  const cp = getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const PS = S.profile;

  const goPatientFromSub = () => navigate('patient', { patientId: S.patientId });
  const goSummaryFromSub = () => navigate('summary', { patientId: S.patientId });

  const defaultNotes = () => 'מטופל בטיפול. מוטיבציה גבוהה ושיתוף פעולה. הומלץ על המשך מעקב שבועי ועבודה על כלי ויסות.';

  const now = new Date();
  const letterDate = String(now.getDate()).padStart(2, '0')
    + '.' + String(now.getMonth() + 1).padStart(2, '0')
    + '.' + String(now.getFullYear());
  const letterText = [
    'לכבוד,',
    'גורם מטפל / גורם מפנה / לתיק,',
    '',
    'הנדון: סיכום טיפול: ' + cp.name,
    '',
    hg('אני [[החתום|החתומה]] מטה, ד״ר רותם שגב, פסיכולוגית קלינית, [[מאשר|מאשרת]] כי ', PS.gender) + cp.name + ', טלפון ' + cp.phone + hg(', [[מטופל|מטופלת|בטיפול]] אצלי מאז ', (cp as any).gender) + formatPatientSince(cp.created_at) + ' במסגרת טיפול פסיכולוגי.',
    '',
    'להלן עיקרי המצב הנוכחי:',
    '',
    '• ' + (S.notesOverrides[cp.id] || defaultNotes()),
    '',
    hg('הטיפול ממשיך על בסיס שבועי. [[מצב המטופל יציב וניכרת|מצב המטופלת יציב וניכרת|המצב יציב וניכרת]] התקדמות לאורך הזמן.', (cp as any).gender),
    '',
    'בברכה,',
    'ד״ר רותם שגב | פסיכולוגית קלינית | מספר רישיון 27-104882',
    'rotem@clinic.co.il',
    '',
    'תאריך: ' + letterDate,
  ];
  const letterLines = letterText.map((l) => ({ text: l }));
  const copyLetter = () => copyToClipboard(letterText.join('\n'), 'המכתב הועתק ללוח');
  const printLetter = () => window.print();

  // profile footer — saved identity (single source of truth)
  const profileName = PS.name;
  const avatarBg = PS.avatarColor || 'var(--primary)';
  const hasAvatarPhoto = !!PS.avatar;
  const avatarInitials = initials(PS.name);
  const profileFooterMeta = PS.title + (PS.license ? ' · מספר רישיון ' : '');
  const profileFooterLicense = PS.license || '';
  const aiDisclaimerNote = hg('מסמך זה נוצר בעזרת AI ועשוי לדרוש עריכה לפני שליחה רשמית. שיקול הדעת הקליני נותר תמיד בידי [[המטפל|המטפלת]].', PS.gender);

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <a onClick={goPatientFromSub} className="lt-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>{cp.name}</a>
        <span>›</span>
        <a onClick={goSummaryFromSub} className="lt-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>סיכום AI</a>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>מכתב קליני</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-.6px' }}>מכתב קליני</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5 }}>מסמך מקצועי מבוסס ניתוח AI · {cp.name}</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10 }}>
          <button onClick={copyLetter} className="lt-outline-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>העתקה
          </button>
          <ShareMenu
            subject={'מכתב קליני · ' + cp.name}
            text={letterText.join('\n')}
            note="המכתב כולל פרטי מטופל. שתפו רק עם נמען מורשה ובערוץ מאובטח בהתאם לנהלי המרפאה."
            triggerClassName="lt-outline-btn"
            triggerStyle={{ height: 42, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}
          />
          <button onClick={printLetter} className="lt-primary-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--on-accent)"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" /></svg>הדפסה
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: '0 2px 12px rgba(16,40,80,.08)', padding: '48px 52px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {letterLines.map((l, i) => (
            <div key={i} style={{ fontFamily: "'Heebo',system-ui,sans-serif", fontSize: 15.5, lineHeight: 2, color: 'var(--text)', minHeight: 22 }}>{l.text}</div>
          ))}
        </div>
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarBg, color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, overflow: 'hidden', flexShrink: 0 }}>
            {hasAvatarPhoto
              ? <img src={PS.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span>{avatarInitials}</span>}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{profileName}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{profileFooterMeta}<span dir="ltr">{profileFooterLicense}</span></div>
          </div>
          <div style={{ marginInlineStart: 'auto', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'end' }}>
            <div>סנסיי · ניהול שקט למטפלים</div>
            <div>נוצר אוטומטית · בסיוע AI</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--warning-strong)" style={{ flexShrink: 0, marginTop: 1 }}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /></svg>{aiDisclaimerNote}
      </div>
    </div>
  );
}
