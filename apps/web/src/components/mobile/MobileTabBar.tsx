// Thumb-reachable bottom navigation (mobile only). Surfaces the primary
// daily-action destinations — the navConfig group *before the first section* —
// so the most-used screens are one tap away in the thumb zone. The header
// hamburger drawer keeps the full nav (records/tracking + pinned utilities), so
// this adds fast access without hiding anything. Single source of truth:
// navConfig (same list the sidebar, ⌘K palette, and global search derive from).
import { navConfig } from '../../nav/navConfig';
import { useApp } from '../../store/AppStore';

// Primary = destinations up to the first section header. Grows/shrinks with
// navConfig automatically (governance: the "primary" group defines the tab bar).
const PRIMARY = (() => {
  const out: { key: string; icon: string }[] = [];
  for (const n of navConfig()) {
    if (n.section) break;
    if (n.key && n.icon) out.push({ key: n.key, icon: n.icon });
  }
  return out;
})();

// Terse thumb-bar labels (tab bars use shorter labels than the full sidebar).
const TAB_LABEL: Record<string, string> = {
  dashboard: 'בית', patients: 'מטופלים', calendar: 'יומן',
};

// A tab stays active while on one of its drill-in routes.
const ACTIVE_ALIAS: Record<string, string[]> = {
  patients: ['patient'],
  dashboard: [],
  calendar: [],
};

export default function MobileTabBar() {
  const { S, navigate } = useApp();
  return (
    <nav className="mob-tabbar" aria-label="ניווט ראשי">
      {PRIMARY.map((n) => {
        const active = S.route === n.key || (ACTIVE_ALIAS[n.key] || []).includes(S.route);
        const label = TAB_LABEL[n.key] || n.key;
        return (
          <button
            key={n.key}
            type="button"
            className={'mob-tab' + (active ? ' active' : '')}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            onClick={() => navigate(n.key)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d={n.icon} /></svg>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
