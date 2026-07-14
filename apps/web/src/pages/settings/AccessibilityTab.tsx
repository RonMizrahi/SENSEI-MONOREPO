// Settings · Accessibility tab — text size, contrast, reduced motion, strong
// focus, reading spacing and underline-links. Every control calls setA11y
// (applied + toasted immediately) or resetA11y. Ported from the prototype's
// `setAccessibility` block + a11y derivations.
import { useApp } from '../../store/AppStore';
import { keyAct, Toggle } from './shared';

const SIZE_OPTS = [
  { key: 'small', label: 'קטן', sample: '15px' },
  { key: 'default', label: 'רגיל', sample: '19px' },
  { key: 'large', label: 'גדול', sample: '24px' },
  { key: 'xlarge', label: 'גדול מאוד', sample: '30px' },
];

const READING_OPTS = [
  { key: 'default', label: 'רגיל', desc: 'ריווח שורות סטנדרטי' },
  { key: 'spacious', label: 'מרווח', desc: 'שורות ורווחי אותיות מוגדלים' },
];

const CONTRAST_ICON = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z';
const MOTION_ICON = 'M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z';
const FOCUS_ICON = 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z';
const UNDERLINE_ICON = 'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z';

// One toggle row inside the "vision & motion" and "underline" groups.
function ToggleRow({ icon, title, desc, checked, onToggle, ariaLabel, top }: { icon: string; title: string; desc: string; checked: boolean; onToggle: () => void; ariaLabel: string; top?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderTop: top ? '1px solid var(--line)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-surface)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d={icon} /></svg>
        </div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</div>
        </div>
      </div>
      <Toggle checked={checked} onToggle={onToggle} ariaLabel={ariaLabel} />
    </div>
  );
}

export default function AccessibilityTab() {
  const { S, setA11y, resetA11y } = useApp();
  const A = S.a11y || {};

  const contrastOn = A.contrast === 'high';
  const motionOn = !!A.reduceMotion;
  const focusOn = !!A.strongFocus;
  const underlineOn = !!A.underlineLinks;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>נגישות</h2>
      <p style={{ margin: '0 0 26px', color: 'var(--text-secondary)', fontSize: 14 }}>התאמת גודל התצוגה, הניגודיות, התנועה והקריאוּת לצרכים שלכם. ההעדפות נשמרות ומסתנכרנות בכל המכשירים.</p>

      {/* text size */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: 12 }}>גודל טקסט ותצוגה</div>
      <div role="radiogroup" aria-label="גודל טקסט ותצוגה" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {SIZE_OPTS.map((o) => {
          const on = (A.textSize || 'default') === o.key;
          const select = () => setA11y({ textSize: o.key }, 'גודל הטקסט עודכן');
          return (
            <div key={o.key} onClick={select} onKeyDown={keyAct(select)} role="radio" tabIndex={0} aria-checked={on} aria-label={o.label} className="set-hov-border" style={{ border: `1.5px solid ${on ? 'var(--primary)' : 'var(--divider)'}`, background: on ? 'var(--primary-tint)' : 'var(--surface)', borderRadius: 12, padding: '16px 10px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, minHeight: 96, justifyContent: 'center' }}>
              <span style={{ fontWeight: 800, color: on ? 'var(--primary)' : 'var(--text)', lineHeight: 1, fontSize: o.sample }}>א</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{o.label}</span>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '0 0 30px', fontSize: 12.5, color: 'var(--text-muted)' }}>משנה את גודל הטקסט והממשק בכל המערכת באופן מיידי.</p>

      {/* vision & motion */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: 10 }}>ראייה ותנועה</div>
      <div style={{ border: '1px solid var(--divider)', borderRadius: 12, overflow: 'hidden', marginBottom: 30 }}>
        <ToggleRow icon={CONTRAST_ICON} title="ניגודיות גבוהה" desc="מחזק את ניגודיות הטקסט, הגבולות והפרדת המידע" checked={contrastOn} ariaLabel="ניגודיות גבוהה" onToggle={() => setA11y({ contrast: contrastOn ? 'normal' : 'high' }, contrastOn ? 'ניגודיות גבוהה כובתה' : 'ניגודיות גבוהה הופעלה')} />
        <ToggleRow top icon={MOTION_ICON} title="הפחתת תנועה" desc="מבטל אנימציות ומעברים לאורך המערכת" checked={motionOn} ariaLabel="הפחתת תנועה" onToggle={() => setA11y({ reduceMotion: !motionOn }, motionOn ? 'אנימציות הופעלו מחדש' : 'הפחתת תנועה הופעלה')} />
        <ToggleRow top icon={FOCUS_ICON} title="הדגשת פוקוס מוגברת" desc="מסמן בבירור את הרכיב הפעיל בעת ניווט במקלדת" checked={focusOn} ariaLabel="הדגשת פוקוס מוגברת" onToggle={() => setA11y({ strongFocus: !focusOn }, focusOn ? 'הדגשת הפוקוס הוחזרה לרגיל' : 'הדגשת פוקוס מוגברת הופעלה')} />
      </div>

      {/* reading */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: 12 }}>העדפות קריאה</div>
      <div role="radiogroup" aria-label="ריווח לקריאה" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
        {READING_OPTS.map((r) => {
          const on = (A.reading || 'default') === r.key;
          const select = () => setA11y({ reading: r.key }, 'העדפת הקריאה עודכנה');
          return (
            <div key={r.key} onClick={select} onKeyDown={keyAct(select)} role="radio" tabIndex={0} aria-checked={on} aria-label={r.label} className="set-hov-border" style={{ border: `1.5px solid ${on ? 'var(--primary)' : 'var(--divider)'}`, background: on ? 'var(--primary-tint)' : 'var(--surface)', borderRadius: 12, padding: '15px 16px', cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{r.desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 0', borderTop: '1px solid var(--line)', marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-surface)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d={UNDERLINE_ICON} /></svg>
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>קו תחתון בקישורים</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>מבליט קישורים גם ללא הבחנה בצבע בלבד</div>
          </div>
        </div>
        <Toggle checked={underlineOn} ariaLabel="קו תחתון בקישורים" onToggle={() => setA11y({ underlineLinks: !underlineOn }, underlineOn ? 'קו תחתון בקישורים בוטל' : 'קו תחתון בקישורים הופעל')} />
      </div>

      <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={resetA11y} className="set-hov-primary" style={{ height: 42, padding: '0 20px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>איפוס לברירת מחדל</button>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-muted)"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
          השינויים נשמרים ומוחלים אוטומטית
        </span>
      </div>
    </div>
  );
}
