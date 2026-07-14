// Help & support — ported from 'Sensei demo.dc.html'
// (template lines 1527–1567 · logic: renderVals help/faq section ~4285–4303).
import { CARD_SHADOW } from '../utils/styles';
import { SHORTCUTS } from '../data/shortcuts';

// FAQ + keyboard-shortcut catalog — ported verbatim from the prototype logic class.
const FAQ_SRC = [
  { q: 'כיצד מעלים הקלטת פגישה?', a: 'בחרו מטופל, לחצו על "העלאת הקלטה" וגררו את קובץ האודיו או בחרו אותו מהמחשב. המערכת תתמלל ותנתח את הפגישה אוטומטית. נתמכים הפורמטים MP3, WAV ו-M4A עד 200MB.' },
  { q: 'מה קורה לקובץ האודיו לאחר התמלול?', a: 'כברירת מחדל, קובץ האודיו נמחק מיד עם סיום התמלול ואינו נשמר במערכת. ניתן לשנות זאת בהגדרות הפרטיות, אך הדבר אינו מומלץ מטעמי אבטחת מידע.' },
  { q: 'כיצד נשמרת פרטיות המטופלים?', a: 'המערכת פועלת לפי הרשאות גישה (RBAC). כל מטפל רואה רק את המטופלים שלו. לפני ניתוח ה-AI מתבצע ניקוי פרטים מזהים (PII) מהתמלול, וכל פעולה מתועדת ביומן הפעילות.' },
  { q: 'מהם דגלי הסיכון וכיצד להתייחס אליהם?', a: 'דגלי הסיכון הם אינדיקציות שה-AI מזהה בשיחה (כגון ביטויי מצוקה). הם כלי עזר בלבד ואינם מהווים אבחנה רפואית. שיקול הדעת הקליני נותר תמיד בידי המטפל.' },
  { q: 'כיצד מפיקים דוח הכנה לפגישה?', a: 'בכרטיס המטופל לחצו על "דוח הכנה", או השתמשו בפעולה המהירה "יצירת דוח הכנה" בדף הבית. הדוח מסכם מה השתנה מאז הפגישה האחרונה, נושאים פתוחים, תובנות וסיכום הפגישה האחרונה, וכולל תקציר קולי קצר.' },
];

export default function HelpPage() {
  const faq = FAQ_SRC.map((f, i) => ({ q: f.q, a: f.a, open: i === 0 }));

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>עזרה ותמיכה</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>שאלות נפוצות, קיצורי מקלדת ויצירת קשר</p>
      </div>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--bg)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>שאלות נפוצות</h2>
        </div>
        {faq.map((f, i) => (
          <details key={i} style={{ borderBottom: '1px solid var(--line)' }} open={f.open}>
            <summary style={{ padding: '16px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)" style={{ flexShrink: 0 }}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>{f.q}
            </summary>
            <p style={{ margin: 0, padding: '0 22px 18px 50px', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>{f.a}</p>
          </details>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
          <div style={{ marginTop: 'auto' }}>
            <a href="mailto:support@sensei.co.il" dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 10, background: 'var(--on-accent)', color: 'var(--primary-darker)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>support@sensei.co.il</a>
          </div>
        </div>
      </div>
    </div>
  );
}
