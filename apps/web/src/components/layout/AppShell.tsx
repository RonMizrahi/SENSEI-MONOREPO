// App shell frame: skip link, offline banner, off-canvas nav scrim, sidebar,
// app bar, main content region (+ navigation progress bar), and all global
// overlays (command palette, AI assistant, dialogs, snackbar).
// Ported from the prototype shell template + overlays. The store owns global
// keyboard shortcuts (⌘K, Escape cascade, ?, /, N, G) — the pieces below only
// render from state and wire their own local interactions.
import React from 'react';
import { useApp } from '../../store/AppStore';
import { ROUTE_TITLES } from '../../nav/navConfig';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import AiAssistant from './AiAssistant';
import Dialogs from './Dialogs';
import Snackbar from './Snackbar';
import './shell.css';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { S, set } = useApp();
  const offline = S.online === false;
  const closeNav = () => set({ navOpen: false });
  const toggleNav = () => set((s: any) => ({ navOpen: !s.navOpen }));

  // Off-canvas drawer hygiene (≤860px band): while open, lock background scroll,
  // move focus into the drawer and trap Tab inside it (WCAG 2.4.3); on close,
  // return focus to the menu toggle. Backdrop/Escape/navigation closing already
  // exists (scrim below + the store's Escape cascade + navigate()).
  const drawerWasOpen = React.useRef(false);
  React.useEffect(() => {
    const aside = document.querySelector<HTMLElement>('.app-sidebar');
    if (S.navOpen && aside && window.matchMedia('(max-width: 860px)').matches) {
      drawerWasOpen.current = true;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      aside.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
      const trap = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const f = Array.from(aside.querySelectorAll<HTMLElement>('[tabindex="0"], button'));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !aside.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', trap, true);
      return () => {
        document.body.style.overflow = prevOverflow;
        document.removeEventListener('keydown', trap, true);
      };
    }
    if (!S.navOpen && drawerWasOpen.current) {
      drawerWasOpen.current = false;
      document.querySelector<HTMLElement>('.nav-toggle')?.focus();
    }
    return undefined;
  }, [S.navOpen]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">דלגו לתוכן הראשי</a>

      {offline && (
        <div role="status" aria-live="assertive" style={{ position: 'fixed', top: 0, insetInline: 0, zIndex: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 40, padding: '6px 16px', background: 'var(--warning-bg)', color: 'var(--warning-strong)', fontSize: 13.5, fontWeight: 700, borderBottom: '1px solid var(--warning-strong)', textAlign: 'center' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ flexShrink: 0 }}><path d="M24 8.98A16.88 16.88 0 0 0 12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98zM2.92 9.07C5.51 7.08 8.67 6 12 6s6.49 1.08 9.08 3.07l-1.43 1.43A11.94 11.94 0 0 0 12 8c-2.83 0-5.48.98-7.65 2.5L2.92 9.07zM1 3.86 2.84 2l18.3 18.3-1.41 1.41-3.56-3.56L12 21 5.83 14.83l-.85-.85-.7-.7L1 9.86v-6z" /></svg>
          <span>אין חיבור לאינטרנט · העבודה שלכם נשמרת מקומית ותסתנכרן אוטומטית עם חזרת החיבור</span>
        </div>
      )}

      <div onClick={closeNav} className={'nav-scrim' + (S.navOpen ? ' open' : '')} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,40,.5)', zIndex: 199, display: S.navOpen ? 'block' : 'none' }} />

      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <main id="main-content" tabIndex={-1} aria-label={ROUTE_TITLES[S.route] ? 'תוכן ראשי · ' + ROUTE_TITLES[S.route] : 'תוכן ראשי'} style={{ flex: 1, padding: 28, overflow: 'auto' }}>
          {/* Off-canvas drawer opener — the ONLY relocated chrome that must live in
              the content column (it opens the sidebar, so it can't sit inside it).
              Hidden ≥861px by .nav-toggle CSS; flows above content ≤860px. */}
          <button onClick={toggleNav} className="nav-toggle" aria-label="פתיחת תפריט הניווט" style={{ width: 44, height: 44, marginBottom: 16, border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--surface-2)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--text-secondary)" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" /></svg>
          </button>
          {S.loading && (
            <div style={{ position: 'fixed', top: 0, insetInlineStart: 256, insetInlineEnd: 0, height: 3, zIndex: 50, overflow: 'hidden', background: 'var(--primary-tint)' }}>
              <div style={{ position: 'absolute', top: 0, height: 3, background: 'var(--primary)', width: '55%', animation: 'loadbar 1.1s cubic-bezier(.4,0,.2,1) infinite', borderRadius: '0 3px 3px 0' }} />
            </div>
          )}
          {children}
        </main>
      </div>

      {/* app-wide overlays */}
      <CommandPalette />
      <AiAssistant />
      <Dialogs />
      <Snackbar />
    </div>
  );
}
