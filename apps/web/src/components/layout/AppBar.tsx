// Top app bar: mobile nav toggle, demo pill, upload CTA, theme toggle, account avatar.
// Ported from the prototype shell template (appbar) + its view-model handlers.
import React from 'react';
import { useApp } from '../../store/AppStore';
import { clearApiAccessToken } from '../../services/apiAuth';
import { profileInitials } from './Sidebar';
import { SUN, MOON, MONITOR } from '../../utils/themeIcons';


const THEME_LABELS: Record<string, string> = {
  system: 'ערכת נושא: מערכת · לחצו למצב בהיר',
  light: 'ערכת נושא: בהיר · לחצו למצב כהה',
  dark: 'ערכת נושא: כהה · לחצו למצב מערכת',
};
const THEME_MSGS: Record<string, string> = {
  system: 'ערכת נושא: מערכת ההפעלה', light: 'מצב בהיר הופעל', dark: 'מצב כהה הופעל',
};


export default function AppBar() {
  const { S, set, navigate, applyThemePref, toast } = useApp();

  const themePref = S.themePref || 'system';
  const themeIcon = themePref === 'system' ? MONITOR : (themePref === 'dark' ? SUN : MOON);
  const themeToggleLabel = THEME_LABELS[themePref] || THEME_LABELS.system;
  const toggleTheme = () => {
    const order: Record<string, 'system' | 'light' | 'dark'> = { system: 'light', light: 'dark', dark: 'system' };
    const next = order[themePref] || 'light';
    applyThemePref(next);
    toast(THEME_MSGS[next], 'info');
  };

  const PS = S.profile || {};
  const avatarBg = PS.avatarColor || 'var(--primary)';
  const hasPhoto = !!PS.avatar;
  const openAccount = () => navigate('settings', { settingsTab: 'profile' });
  const openUpload = () => set({ route: 'upload', upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  const toggleNav = () => set((s: any) => ({ navOpen: !s.navOpen }));
  const exitDemo = () => {
    clearApiAccessToken();
    set({ view: 'auth', authScreen: 'login', demoMode: false, loginLoading: false, loginError: '' });
  };

  const onKeyActivate = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  return (
    <header className="appbar" style={{ height: 64, background: 'var(--paper)', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px', position: 'sticky', top: 0, zIndex: 20 }}>
      <button onClick={toggleNav} className="nav-toggle" aria-label="פתיחת תפריט הניווט" style={{ width: 40, height: 40, flexShrink: 0, border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--surface-2)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--text-secondary)"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" /></svg>
      </button>

      <div className="appbar-spacer" style={{ flex: 1 }} />

      {S.demoMode && (
        <div className="demo-pill" role="status" aria-label="מצב הדגמה פעיל · מוצגים נתוני הדגמה בלבד" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 6px 0 12px', borderRadius: 20, background: 'var(--warning-bg)', border: '1px solid var(--warning-strong)', flexShrink: 0 }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning-strong)', flexShrink: 0, animation: 'pulse 1.8s ease-in-out infinite' }} />
          <span className="demo-pill-label" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warning)', whiteSpace: 'nowrap' }}>מצב הדגמה · נתונים לדוגמה</span>
          <button onClick={exitDemo} aria-label="יציאה ממצב הדגמה" title="יציאה ממצב הדגמה" className="shell-demo-x" style={{ width: 24, height: 24, border: 'none', borderRadius: '50%', background: 'rgba(120,70,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--warning)"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
      )}

      <button onClick={openUpload} className="appbar-cta shell-cta" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--paper)"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
        <span className="cta-label">העלאת הקלטה</span>
      </button>

      <button onClick={() => navigate('help')} aria-label="עזרה ותמיכה" title="עזרה ותמיכה · שאלות נפוצות, מדריכים וקיצורי מקלדת" className="shell-iconbtn appbar-hide-sm" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="var(--text-secondary)"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" /></svg>
      </button>

      <div onClick={toggleTheme} onKeyDown={onKeyActivate(toggleTheme)} role="button" tabIndex={0} aria-label={themeToggleLabel} title={themeToggleLabel} className="shell-iconbtn" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="var(--text-secondary)"><path d={themeIcon} /></svg>
      </div>

      <div style={{ width: 1, height: 28, background: 'var(--divider)' }} />

      <div onClick={openAccount} onKeyDown={onKeyActivate(openAccount)} role="button" tabIndex={0} aria-label="החשבון שלי · הגדרות" className="shell-avatar-btn" style={{ width: 38, height: 38, borderRadius: '50%', background: avatarBg, color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
        {hasPhoto ? <img src={PS.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{profileInitials(PS.name)}</span>}
      </div>
    </header>
  );
}
