// App shell frame: skip link, offline banner, off-canvas nav scrim, sidebar,
// app bar, main content region (+ navigation progress bar), and all global
// overlays (command palette, AI assistant, dialogs, snackbar).
// Ported from the prototype shell template + overlays. The store owns global
// keyboard shortcuts (⌘K, Escape cascade, ?, /, N, G) — the pieces below only
// render from state and wire their own local interactions.
import React from 'react';
import { useApp } from '../../store/AppStore';
import Sidebar from './Sidebar';
import AppBar from './AppBar';
import CommandPalette from './CommandPalette';
import AiAssistant from './AiAssistant';
import Dialogs from './Dialogs';
import Snackbar from './Snackbar';
import './shell.css';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { S, set } = useApp();
  const offline = S.online === false;
  const closeNav = () => set({ navOpen: false });

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
        <AppBar />

        <main id="main-content" tabIndex={-1} aria-label="תוכן ראשי" style={{ flex: 1, padding: 28, overflow: 'auto' }}>
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
