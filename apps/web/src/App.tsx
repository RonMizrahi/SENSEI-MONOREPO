import React, { Suspense, lazy } from 'react';
import { useApp } from './store/AppStore';
import { useIsMobile } from './hooks/useIsMobile';
import AppShell from './components/layout/AppShell';
import MobileApp from './components/mobile/MobileApp';
import AuthScreens from './pages/auth/AuthScreens';
import ErrorBoundary from './components/shared/ErrorBoundary';
import PageFallback from './components/shared/PageFallback';

// Route-level code splitting: one chunk per screen.
const PAGES: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: lazy(() => import('./pages/DashboardPage')),
  patients: lazy(() => import('./pages/PatientsPage')),
  patientArchive: lazy(() => import('./pages/PatientArchivePage')),
  patient: lazy(() => import('./pages/PatientPage')),
  calendar: lazy(() => import('./pages/CalendarPage')),
  upload: lazy(() => import('./pages/UploadPage')),
  transcript: lazy(() => import('./pages/TranscriptPage')),
  summary: lazy(() => import('./pages/SummaryPage')),
  meetingHistory: lazy(() => import('./pages/PatientMeetingHistoryPage')),
  upcomingMeetings: lazy(() => import('./pages/PatientUpcomingMeetingsPage')),
  session: lazy(() => import('./pages/SessionDetailPage')),
  report: lazy(() => import('./pages/ReportPage')),
  nextMeetingReport: lazy(() => import('./pages/NextMeetingReportPage')),
  letter: lazy(() => import('./pages/LetterPage')),
  notifications: lazy(() => import('./pages/NotificationsPage')),
  search: lazy(() => import('./pages/SearchPage')),
  help: lazy(() => import('./pages/HelpPage')),
  settings: lazy(() => import('./pages/SettingsPage')),
};

export default function App() {
  const { S, navigate } = useApp();
  const isMobile = useIsMobile();
  if (S.view === 'auth') return <AuthScreens />;
  const Page = PAGES[S.route] || PAGES.dashboard;

  // Below the phone breakpoint, render the dedicated mobile experience; it owns
  // its own chrome, routing to bespoke mobile screens or the shared route page.
  if (isMobile) return <MobileApp route={S.route} Page={Page} />;

  return (
    <AppShell>
      <ErrorBoundary resetKey={S.route} onReset={() => navigate('dashboard')}>
        <Suspense fallback={<PageFallback />}>
          <Page />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
