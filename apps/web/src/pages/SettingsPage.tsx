// Settings screen — tab rail plus preference panes (profile · appearance · accessibility).
import { useApp } from '../store/AppStore';
import { CARD_SHADOW } from '../utils/styles';
import './settings.css';
import ProfileTab from './settings/ProfileTab';
import AppearanceTab from './settings/AppearanceTab';
import AccessibilityTab from './settings/AccessibilityTab';

// The product is Hebrew-only by design (see PRODUCT.md non-goals) — there is no
// language setting. 'appearance' stays as the internal tab key; the user-facing
// term is ערכת נושא (Theme) everywhere.
const STABS = [
  { key: 'profile', label: 'פרופיל', icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
  { key: 'appearance', label: 'ערכת נושא', icon: 'M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67 0 1.38-1.12 2.5-2.5 2.5zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 0 0-.14-.35c-.41-.46-.63-1.05-.63-1.65 0-1.38 1.12-2.5 2.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z' },
  { key: 'accessibility', label: 'נגישות', icon: 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z' },
];

const PANE_TABS = new Set(['profile', 'appearance', 'accessibility']);

export default function SettingsPage() {
  const { S, set } = useApp();
  const active = PANE_TABS.has(S.settingsTab) ? S.settingsTab : 'profile';

  const tabs = STABS.map((t) => {
    const on = active === t.key;
    return {
      key: t.key, label: t.label, icon: t.icon,
      onClick: () => set({ settingsTab: t.key }),
      color: on ? 'var(--primary)' : 'var(--text-2)',
      bg: on ? 'var(--primary-tint)' : 'transparent', weight: on ? 700 : 500,
    };
  });

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>הגדרות</h1>
      <p style={{ margin: '0 0 22px', color: 'var(--text-secondary)', fontSize: 15 }}>ניהול הפרופיל וההעדפות שלכם</p>
      <div className="rx-side" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20 }}>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 8, height: 'fit-content' }}>
          {tabs.map((t) => (
            <a key={t.key} onClick={t.onClick} className="set-tab" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 10, cursor: 'pointer', fontSize: 14.5, fontWeight: t.weight, color: t.color, background: t.bg }}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d={t.icon} /></svg>
              {t.label}
            </a>
          ))}
        </div>

        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26 }}>
          {active === 'profile' && <ProfileTab />}
          {active === 'appearance' && <AppearanceTab />}
          {active === 'accessibility' && <AccessibilityTab />}
        </div>
      </div>
    </div>
  );
}
