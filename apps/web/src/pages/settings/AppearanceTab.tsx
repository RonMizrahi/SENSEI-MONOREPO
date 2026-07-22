// Settings · Appearance tab — the three-state theme preference cards
// (system / light / dark). Selecting a card calls applyThemePref, which
// persists the preference and syncs it across devices. Ported from the
// prototype's `setOther` block + themeOptions derivation.
import { useApp } from '../../store/AppStore';
import { keyAct } from './shared';
import { SUN, MOON, MONITOR } from '../../utils/themeIcons';


const THEMES: { key: 'system' | 'light' | 'dark'; label: string; desc: string; icon: string }[] = [
  { key: 'system', label: 'מערכת', desc: 'תואם את הגדרת המכשיר', icon: MONITOR },
  { key: 'light', label: 'בהיר', desc: 'תמיד מצב בהיר', icon: SUN },
  { key: 'dark', label: 'כהה', desc: 'תמיד מצב כהה', icon: MOON },
];

export default function AppearanceTab() {
  const { S, applyThemePref } = useApp();

  const statusText = S.themePref === 'system'
    ? 'עוקב אחר המערכת · כעת פעיל מצב ' + (S.theme === 'dark' ? 'כהה' : 'בהיר')
    : 'מצב ' + (S.theme === 'dark' ? 'כהה' : 'בהיר') + ' נבחר ידנית';

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>ערכת נושא</h2>
      <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>בחרו כיצד סנסיי נראה. הבחירה נשמרת ומסתנכרנת בכל המכשירים.</p>
      <div role="radiogroup" aria-label="ערכת נושא" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {THEMES.map((opt) => {
          const on = S.themePref === opt.key;
          const select = () => applyThemePref(opt.key);
          return (
            <div key={opt.key} onClick={select} onKeyDown={keyAct(select)} role="radio" tabIndex={0} aria-checked={on} aria-label={opt.label} className="set-hov-border" style={{ border: `1.5px solid ${on ? 'var(--primary)' : 'var(--divider)'}`, background: on ? 'var(--primary-tint)' : 'var(--surface)', borderRadius: 12, padding: '16px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--primary)' : 'var(--surface-2)', color: on ? 'var(--paper)' : 'var(--text-secondary)' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d={opt.icon} /></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>{opt.desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--text-muted)"><path d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-18C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-1 15h2v-6h-2v6z" /></svg>
        <span>{statusText}</span>
      </div>
    </div>
  );
}
