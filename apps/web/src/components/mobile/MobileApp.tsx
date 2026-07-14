// Mobile app shell — rendered instead of AppShell below 768px (see App.tsx /
// useIsMobile). Provides the phone chrome (compact header + the existing sidebar
// as a slide-in drawer, reusing S.navOpen; the drawer's fixed/off-canvas rules
// live in tokens.css — .app-sidebar/.nav-scrim), routes to bespoke mobile
// screens where they exist, and otherwise renders the shared route page in a
// narrow wrapper. Global overlays (Snackbar/Dialogs) are reused as-is.
import React, { Suspense, useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import Sidebar, { profileInitials } from '../layout/Sidebar';
import Snackbar from '../layout/Snackbar';
import Dialogs from '../layout/Dialogs';
import ErrorBoundary from '../shared/ErrorBoundary';
import PageFallback from '../shared/PageFallback';
import MobileDayView from './MobileDayView';
import MobilePrepReport from './MobilePrepReport';
import MobilePatient from './MobilePatient';
import MobileRecording from './MobileRecording';
import { MenuIcon } from './icons';
import './mobile.css';

interface Props {
  route: string;
  Page: React.ComponentType;
}

export default function MobileApp({ route, Page }: Props) {
  const { S, set, navigate } = useApp();
  const closeNav = () => set({ navOpen: false });
  const [recording, setRecording] = useState<{ pid: string; name: string; meetingId?: string } | null>(null);
  // pid may be '' for an appointment with no linked patient — record it as
  // unlinked rather than silently attributing it to the currently-selected one.
  // meetingId (the appointment's calendar event) is what lets the capture upload
  // to a real backend; a record action without one stays a local/demo capture.
  const openRecording = (pid: string, name: string, meetingId?: string) => setRecording({ pid, name, meetingId });
  // Never leave the full-screen recording overlay mounted over a different
  // screen — clear it whenever the route changes (Back button, deep link, etc.).
  useEffect(() => { setRecording(null); }, [route]);

  // Route → bespoke mobile screen, else the shared route page (narrow wrapper).
  let screen: React.ReactNode;
  if (route === 'dashboard') screen = <MobileDayView onOpenRecording={openRecording} />;
  else if (route === 'patient') screen = <MobilePatient />;
  else if (route === 'report' || route === 'nextMeetingReport') screen = <MobilePrepReport onOpenRecording={openRecording} />;
  else screen = <Page />;

  return (
    <div className="mob-shell">
      <a href="#main-content" className="skip-link">דלגו לתוכן הראשי</a>

      <header className="mob-header">
        <button type="button" className="mob-iconbtn" aria-label="פתיחת התפריט" onClick={() => set({ navOpen: true })}>
          <MenuIcon />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/assets/sensei-mark.png" alt="" aria-hidden="true" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>סנסיי</span>
        </div>
        <div className="mob-avatar" aria-hidden="true">{profileInitials(S.profile.name)}</div>
      </header>

      {/* off-canvas nav — reuses the desktop Sidebar + shell.css drawer rules */}
      <div onClick={closeNav} className={'nav-scrim' + (S.navOpen ? ' open' : '')} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,40,.5)', zIndex: 199, display: S.navOpen ? 'block' : 'none' }} />
      <Sidebar />

      <main id="main-content" tabIndex={-1} aria-label="תוכן ראשי" className="mob-content">
        <ErrorBoundary resetKey={route} onReset={() => navigate('dashboard')}>
          <Suspense fallback={<div style={{ padding: 16 }}><PageFallback /></div>}>
            {screen}
          </Suspense>
        </ErrorBoundary>
      </main>

      {recording && <MobileRecording pid={recording.pid} name={recording.name} meetingId={recording.meetingId} onClose={() => setRecording(null)} />}

      <Snackbar />
      <Dialogs />
    </div>
  );
}
