// App sidebar (right in RTL) — the single home for app chrome now that the top
// bar is gone: brand, the primary "Upload recording" CTA, destinations from
// navConfig(), a demo-mode indicator, theme toggle, account, and logout.
import React from 'react';
import { useApp } from '../../store/AppStore';
import { navConfig } from '../../nav/navConfig';
import { clearApiAccessToken } from '../../services/apiAuth';
import { isApiConfigured } from '../../services/apiClient';
import { SUN, MOON, MONITOR } from '../../utils/themeIcons';

const THEME_LABELS: Record<string, string> = {
  system: 'ערכת נושא: מערכת · לחצו למצב בהיר',
  light: 'ערכת נושא: בהיר · לחצו למצב כהה',
  dark: 'ערכת נושא: כהה · לחצו למצב מערכת',
};
const THEME_MSGS: Record<string, string> = {
  system: 'ערכת נושא: מערכת ההפעלה', light: 'מצב בהיר הופעל', dark: 'מצב כהה הופעל',
};

// Initials for the profile avatar — ported from the prototype's _initials().
export function profileInitials(name: any): string {
  const src = String(name || '').replace(/["'׳״]/g, '').trim();
  if (!src) return '·';
  const stop: Record<string, number> = { 'דר': 1, 'ד': 1, 'פרופ': 1, 'מר': 1, 'גב': 1, dr: 1, prof: 1 };
  const words = src.split(/\s+/).filter((w) => !stop[w.toLowerCase()]);
  const use = (words.length ? words : src.split(/\s+/)).slice(0, 2);
  const letters = use.map((w) => w[0]).join('');
  return letters.length > 1 ? letters[0] + '״' + letters[1] : letters;
}

export default function Sidebar() {
  const { S, set, navigate, logout, applyThemePref, toast } = useApp();
  const PS = S.profile;

  // ---- relocated top-bar actions (top bar was removed app-wide) ----
  const openAccount = () => navigate('settings', { settingsTab: 'profile' });
  const themePref = S.themePref || 'system';
  const themeIcon = themePref === 'system' ? MONITOR : (themePref === 'dark' ? SUN : MOON);
  const themeToggleLabel = THEME_LABELS[themePref] || THEME_LABELS.system;
  const toggleTheme = () => {
    const order: Record<string, 'system' | 'light' | 'dark'> = { system: 'light', light: 'dark', dark: 'system' };
    const next = order[themePref] || 'light';
    applyThemePref(next);
    toast(THEME_MSGS[next], 'info');
  };
  const exitDemo = () => {
    clearApiAccessToken();
    set({ view: 'auth', authScreen: 'login', demoMode: false, loginLoading: false, loginError: '' });
  };
  const demoUsesServer = isApiConfigured();
  const demoPillLabel = demoUsesServer
    ? 'מצב הדגמה · נתונים מהשרת'
    : 'מצב הדגמה · נתונים לדוגמה';
  const demoPillAria = demoUsesServer
    ? 'מצב הדגמה פעיל · מוצגים נתונים מהשרת'
    : 'מצב הדגמה פעיל · מוצגים נתוני הדגמה בלבד';
  const onKeyActivate = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  const mkItem = (n: any) => {
    const active = S.route === n.key
      || (n.key === 'meetingHistory' && S.route === 'session')
      || (n.key === 'patients' && S.route === 'patient')
      || (n.key === 'nextMeetingReport' && S.route === 'report');
    const go = () => {
      // Spec (Screen 4): the nav entry opens the all-patients history DIRECTORY.
      // Preserving the selected patient here made the directory unreachable once
      // any patient was picked — per-patient history stays reachable from the
      // patient file ("כל ההיסטוריה") and from deep links (#/meetingHistory/p3).
      if (n.key === 'meetingHistory') navigate('meetingHistory', { patientId: null });
      else navigate(n.key);
    };
    return {
      isSection: false, ...n,
      color: active ? 'var(--paper)' : 'var(--ink-text)',
      bg: active ? 'var(--primary)' : 'transparent',
      weight: active ? 700 : 500,
      onClick: go,
      onKey: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } },
      ariaCurrent: active ? ('page' as const) : undefined,
    };
  };

  // Split destinations into the scrolling body and a pinned utility group. Sections
  // flagged `pinned` (General → Settings/Help) render at the bottom of the nav so they
  // stay reachable even when the destination list grows taller than the viewport.
  const mainItems: any[] = [], pinnedItems: any[] = [];
  let inPinned = false;
  for (const n of navConfig() as any[]) {
    if (n.section) { inPinned = !!n.pinned; (inPinned ? pinnedItems : mainItems).push({ isSection: true, label: n.section }); }
    else (inPinned ? pinnedItems : mainItems).push(mkItem(n));
  }

  const renderRow = (n: any) => n.isSection ? (
    <div key={'s' + n.label} style={{ padding: '14px 14px 5px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>{n.label}</div>
  ) : (
    <a key={n.key} onClick={n.onClick} onKeyDown={n.onKey} role="button" tabIndex={0} aria-current={n.ariaCurrent} className={n.bg === 'transparent' ? 'shell-nav-link' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 14.5, fontWeight: n.weight, color: n.color, background: n.bg }}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" style={{ flexShrink: 0 }}><path d={n.icon} /></svg>
      <span style={{ flex: 1 }}>{n.label}</span>
    </a>
  );

  return (
    <aside aria-label="תפריט ראשי" className={'app-sidebar ' + (S.navOpen ? 'open' : '')} style={{ width: 256, flexShrink: 0, background: 'var(--ink)', color: 'var(--ink-text)', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', padding: '18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 20px 22px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.22)' }}>
          <img src="/assets/sensei-mark.png" alt="לוגו סנסיי" width={38} height={38} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
        </div>
        <div>
          {/* on the fixed-dark ink panel use --ink-text, not --paper: --paper goes dark
              in dark theme and rendered this text 1.12:1 against the sidebar */}
          <div style={{ color: 'var(--ink-text)', fontSize: 19, fontWeight: 800, lineHeight: 1 }}>סנסיי</div>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>ניהול שקט למטפלים</div>
        </div>
      </div>

      {/* Demo-mode indicator (the upload CTA was removed from the side menu by
          request — the upload flow stays reachable from the home cards, agenda
          quick actions, patient file, and the #/upload deep link) */}
      <div style={{ padding: '0 16px 12px' }}>
        {S.demoMode && (
          <div className="demo-pill" role="status" aria-label={demoPillAria} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 6px 0 12px', borderRadius: 20, background: 'var(--warning-bg)', border: '1px solid var(--warning-strong)' }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning-strong)', flexShrink: 0, animation: 'pulse 1.8s ease-in-out infinite' }} />
            <span className="demo-pill-label" style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--warning)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{demoPillLabel}</span>
            <button onClick={exitDemo} aria-label="יציאה ממצב הדגמה" title="יציאה ממצב הדגמה" className="shell-demo-x" style={{ width: 24, height: 24, border: 'none', borderRadius: '50%', background: 'rgba(120,70,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--warning)" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {mainItems.map(renderRow)}
        </div>
        {pinnedItems.length > 0 && (
          <div style={{ flexShrink: 0, padding: '6px 12px 2px', display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid rgba(255,255,255,.08)' }}>
            {pinnedItems.map(renderRow)}
          </div>
        )}
      </nav>
      <div style={{ padding: '12px 14px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Account — the profile is now the entry to settings (relocated from the top bar) */}
        <button onClick={openAccount} onKeyDown={onKeyActivate(openAccount)} aria-label="החשבון שלי · הגדרות" className="shell-nav-link" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 10, fontFamily: 'inherit', textAlign: 'start' }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: PS.avatarColor || 'var(--primary)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
            {PS.avatar
              ? <img src={PS.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span>{profileInitials(PS.name)}</span>}
          </span>
          <div style={{ flex: 1, minWidth: 0, color: 'var(--ink-text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PS.name}</div>
        </button>
        {/* Theme toggle — relocated from the top bar */}
        <div onClick={toggleTheme} onKeyDown={onKeyActivate(toggleTheme)} role="button" tabIndex={0} aria-label={themeToggleLabel} title={themeToggleLabel} className="shell-logout" style={{ width: 20, height: 20, flexShrink: 0, cursor: 'pointer', boxSizing: 'content-box', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--ink-muted)" aria-hidden="true"><path d={themeIcon} /></svg>
        </div>
        <div onClick={logout} onKeyDown={onKeyActivate(logout)} role="button" tabIndex={0} aria-label="התנתקות מהמערכת" className="shell-logout" style={{ width: 20, height: 20, flexShrink: 0, cursor: 'pointer', boxSizing: 'content-box', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--ink-muted)" aria-hidden="true"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>
        </div>
      </div>
    </aside>
  );
}
