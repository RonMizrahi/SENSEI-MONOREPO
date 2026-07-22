// Help & Support hub: searchable FAQ · troubleshooting · shortcuts · contact +
// feedback · privacy & security (shared SSOT) · about/legal · version.
import { useMemo, useState } from 'react';
import { CARD_SHADOW } from '../utils/styles';
import { SHORTCUTS } from '../data/shortcuts';
import { isApiConfigured } from '../services/apiClient';
import { PRIVACY_TOOLTIP_TITLE, resolvePrivacyCapabilities, privacyItems } from '../data/privacyNotice';
import { normHe } from '../utils/search';
import Highlight from '../components/shared/Highlight';

// FAQ + keyboard-shortcut catalog — ported verbatim from the prototype logic class.
const FAQ_SRC = [
  { q: 'כיצד מעלים הקלטת פגישה?', a: 'בחרו מטופל, לחצו על "העלאת הקלטה" וגררו את קובץ האודיו או בחרו אותו מהמחשב. המערכת תתמלל ותנתח את הפגישה אוטומטית. נתמכים הפורמטים MP3, WAV ו-M4A עד 25MB.' },
  { q: 'מה קורה לקובץ האודיו לאחר התמלול?', a: 'קובץ האודיו משמש לתמלול בלבד ואינו נשמר לאורך זמן. בגרסת ההדגמה הנוכחית העיבוד מתבצע במכשיר שלכם והתמלול המוצג הוא תוכן הדגמה.' },
  { q: 'כיצד נשמרת פרטיות המטופלים?', a: 'בגרסה הנוכחית כל הנתונים נשמרים מקומית בדפדפן שלכם בלבד ואינם נשלחים לשרת. אתם שולטים בהם במלואם: ייצוא, שחזור או מחיקה מלאה דרך הגדרות ← "הנתונים שלך".' },
  { q: 'מהם דגלי הסיכון וכיצד להתייחס אליהם?', a: 'דגלי הסיכון הם אינדיקציות שה-AI מזהה בשיחה (כגון ביטויי מצוקה). הם כלי עזר בלבד ואינם מהווים אבחנה רפואית. שיקול הדעת הקליני נותר תמיד בידי המטפל.' },
  { q: 'כיצד מפיקים דוח הכנה לפגישה?', a: 'בכרטיס המטופל לחצו על "דוח הכנה", או פתחו את "דוח לפגישה הבאה" מהתפריט הראשי ובחרו מטופל. הדוח מסכם מה השתנה מאז הפגישה האחרונה, נושאים פתוחים, תובנות וסיכום הפגישה האחרונה, וכולל תקציר קולי קצר.' },
];

// Troubleshooting — the failures a therapist can actually hit in this
// client-only build, each with the concrete next step.
const TROUBLESHOOT = [
  { q: 'קובץ ההקלטה נדחה בהעלאה', a: 'ודאו שהקובץ בפורמט MP3, WAV או M4A. קבצי וידאו או מסמכים אינם נתמכים · ניתן להמיר את ההקלטה לאודיו ולנסות שוב.' },
  { q: 'אין חיבור לאינטרנט באמצע העבודה', a: 'המשיכו לעבוד כרגיל · הערות והעלאות נשמרות מקומית במכשיר ומסונכרנות אוטומטית עם חזרת החיבור. סרגל התראה יופיע בראש המסך כל עוד אין חיבור.' },
  { q: 'הנתונים לא מופיעים במכשיר אחר', a: 'בגרסה הנוכחית הנתונים נשמרים מקומית בדפדפן. להעברה בין מכשירים: הגדרות ← פרופיל ← "הנתונים שלך" · ייצאו קובץ גיבוי במכשיר אחד ושחזרו אותו באחר.' },
  { q: 'המסך נראה תקוע אחרי עדכון גרסה', a: 'רעננו את הדף (Ctrl+R או ⌘R). המערכת מזהה גרסה חדשה ומתאוששת אוטומטית; רענון ידני פותר כל מקרה קצה.' },
];

export default function HelpPage() {
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  const [faqQuery, setFaqQuery] = useState('');
  const privacyList = privacyItems(resolvePrivacyCapabilities(isApiConfigured()));

  const faq = useMemo(() => {
    const q = normHe(faqQuery.trim());
    const src = FAQ_SRC.filter((f) => !q || normHe(f.q).includes(q) || normHe(f.a).includes(q));
    return src.map((f, i) => ({ q: f.q, a: f.a, open: !faqQuery && i === 0 }));
  }, [faqQuery]);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>עזרה ותמיכה</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>שאלות נפוצות, פתרון תקלות, פרטיות, קיצורי מקלדת ויצירת קשר</p>
      </div>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>שאלות נפוצות</h2>
          <input
            type="search"
            value={faqQuery}
            onChange={(e) => setFaqQuery(e.target.value)}
            aria-label="חיפוש בשאלות נפוצות"
            placeholder="חיפוש בשאלות…"
            className="shell-input"
            style={{ height: 38, minWidth: 180, flex: '1 1 200px', maxWidth: 280, border: '1.5px solid var(--primary-border)', borderRadius: 9, padding: '0 12px', fontSize: 14, background: 'var(--primary-surface)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        {faq.length === 0 ? (
          <p style={{ margin: 0, padding: '22px', fontSize: 14, color: 'var(--text-muted)' }}>לא נמצאו שאלות התואמות לחיפוש. נסו מונח אחר או פנו לתמיכה למטה.</p>
        ) : faq.map((f) => (
          <details key={f.q} style={{ borderBottom: '1px solid var(--line)' }} open={f.open}>
            <summary style={{ padding: '16px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)" style={{ flexShrink: 0 }}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg><span><Highlight text={f.q} query={faqQuery} /></span>
            </summary>
            <p style={{ margin: 0, padding: '0 22px 18px 50px', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>{f.a}</p>
          </details>
        ))}
      </div>

      {/* privacy & security — reuses the single privacy SSOT (data/privacyNotice) */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>{PRIVACY_TOOLTIP_TITLE}</h2>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 22px' }}>
          {privacyList.map((it) => (
            <li key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><path d={it.icon} /></svg>
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* troubleshooting */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--bg)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>פתרון תקלות</h2>
        </div>
        {TROUBLESHOOT.map((t, i) => (
          <details key={i} style={{ borderBottom: '1px solid var(--line)' }}>
            <summary style={{ padding: '16px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--warning-strong)" style={{ flexShrink: 0 }}><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" /></svg>{t.q}
            </summary>
            <p style={{ margin: 0, padding: '0 22px 18px 50px', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>{t.a}</p>
          </details>
        ))}
      </div>

      <div className="rx-side" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>קיצורי מקלדת</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SHORTCUTS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{s.d}</span>
                <kbd dir="ltr" style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 6, padding: '3px 9px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{s.k}</kbd>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,var(--accent-grad-1),var(--accent-grad-2))', borderRadius: 10, padding: 22, color: 'var(--on-accent)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--on-accent)"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z" /></svg>
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>צריכים עזרה נוספת?</h2>
          <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.6, opacity: .92 }}>צוות התמיכה שלנו זמין בימים א׳–ה׳, 9:00–18:00. נשמח לעזור בכל שאלה.</p>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="mailto:support@sensei.co.il" dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 10, background: 'var(--on-accent)', color: 'var(--primary-darker)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>support@sensei.co.il</a>
            <a href="mailto:support@sensei.co.il?subject=%D7%9E%D7%A9%D7%95%D7%91%20%D7%A2%D7%9C%20%D7%A1%D7%A0%D7%A1%D7%99%D7%99" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 10, border: '1.5px solid var(--on-accent)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>שליחת משוב</a>
          </div>
        </div>
      </div>

      {/* about · legal · version */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 22, marginTop: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>אודות ומידע משפטי</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>
          סנסיי היא גרסת הדגמה הפועלת כולה במכשיר שלכם: הנתונים נשמרים מקומית בדפדפן בלבד, אינם נשלחים לשרת,
          וניתנים לייצוא או למחיקה מלאה בכל עת דרך הגדרות ← "הנתונים שלך". תובנות ה-AI המוצגות הן תוכן הדגמה ·
          אינן אבחנה רפואית ואינן תחליף לשיקול דעת קליני.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {appVersion && <span>גרסה <span dir="ltr">{appVersion}</span></span>}
          <span aria-hidden>·</span>
          <span>ימי מענה: א׳–ה׳ 9:00–18:00</span>
          <span aria-hidden>·</span>
          <a href="mailto:support@sensei.co.il?subject=%D7%A4%D7%A0%D7%99%D7%99%D7%94%20%D7%9E%D7%A9%D7%A4%D7%98%D7%99%D7%AA" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>פנייה בנושא פרטיות ומידע</a>
        </div>
      </div>
    </div>
  );
}
