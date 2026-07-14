// App sidebar (right in RTL) — destinations from navConfig(), active-state rules,
// profile footer + logout. Ported from the prototype shell.
import React from 'react';
import { useApp } from '../../store/AppStore';
import { navConfig } from '../../nav/navConfig';

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
  const { S, navigate, logout } = useApp();
  const PS = S.profile;

  const mkItem = (n: any) => {
    const active = S.route === n.key
      || (n.key === 'meetingHistory' && S.route === 'session')
      || (n.key === 'patients' && S.route === 'patient')
      || (n.key === 'nextMeetingReport' && S.route === 'report');
    const go = () => {
      if (n.key === 'meetingHistory') navigate('meetingHistory', { patientId: S.patientId });
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
    <a key={n.key} onClick={n.onClick} onKeyDown={n.onKey} role="button" tabIndex={0} aria-current={n.ariaCurrent} className={n.bg === 'transparent' ? 'shell-nav-link' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 14.5, fontWeight: n.weight, color: n.color, background: n.bg }}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" style={{ flexShrink: 0 }}><path d={n.icon} /></svg>
      <span style={{ flex: 1 }}>{n.label}</span>
    </a>
  );

  return (
    <aside aria-label="תפריט ראשי" className={'app-sidebar ' + (S.navOpen ? 'open' : '')} style={{ width: 256, flexShrink: 0, background: 'var(--ink)', color: 'var(--ink-text)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 20px 22px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.22)' }}>
          <img src="/assets/sensei-mark.png" alt="לוגו סנסיי" width={38} height={38} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
        </div>
        <div>
          <div style={{ color: 'var(--paper)', fontSize: 19, fontWeight: 800, lineHeight: 1 }}>סנסיי</div>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>ניהול שקט למטפלים</div>
        </div>
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
      <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: PS.avatarColor || 'var(--primary)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
          {PS.avatar
            ? <img src={PS.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span>{profileInitials(PS.name)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--paper)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PS.name}</div>
        </div>
        <svg onClick={logout} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); logout(); } }} role="button" tabIndex={0} aria-label="התנתקות מהמערכת" viewBox="0 0 24 24" width="20" height="20" fill="var(--ink-muted)" className="shell-logout" style={{ cursor: 'pointer', boxSizing: 'content-box', padding: 2 }}>
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
        </svg>
      </div>
    </aside>
  );
}
