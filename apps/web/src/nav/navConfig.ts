// Single source of truth for navigation destinations (v2.2.0 contract).
// The sidebar, the ⌘K command palette, and global search ("ניווט מהיר") all
// derive their destination list from here — add a route once and it appears
// in all three. Ported verbatim from the prototype's navConfig().

export interface NavDestination {
  key?: string
  label?: string
  icon?: string
  section?: string
  // A `pinned` section renders at the bottom of the sidebar (always visible, not in
  // the scrolling area) — for low-frequency utility destinations like Settings/Help
  // that must stay reachable as the nav grows past the viewport height.
  pinned?: boolean
}

export function navConfig(): NavDestination[] {
  return [
    // Primary — the daily-action tools (left unlabelled, as the default group).
    { key: 'dashboard', label: 'דף הבית', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
    { key: 'patients', label: 'מטופלים', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
    { key: 'calendar', label: 'יומן', icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z' },
    // Records & tracking — lower-frequency, review-oriented destinations (reports,
    // history, archive). Grouped so the nav reads as "act" (above) vs "review".
    { section: 'מעקב ותיעוד' },
    { key: 'nextMeetingReport', label: 'דוח לפגישה הבאה', icon: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2zm0-4h5v2H8V7z' },
    { key: 'meetingHistory', label: 'היסטוריית פגישות', icon: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z' },
    { key: 'patientArchive', label: 'ארכיון מטופלים', icon: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z' },
    { section: 'כללי', pinned: true },
    { key: 'help', label: 'עזרה ותמיכה', icon: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z' },
    { key: 'settings', label: 'הגדרות', icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z' },
  ];
}

// Document titles per route — screen readers announce route changes via title.
export const ROUTE_TITLES: Record<string, string> = {
  dashboard: 'דף הבית', patients: 'מטופלים', patient: 'תיק מטופל', patientArchive: 'ארכיון מטופלים',
  upload: 'העלאת פגישה', transcript: 'תמלול', summary: 'סיכום AI', meetingHistory: 'היסטוריית פגישות', upcomingMeetings: 'פגישות קרובות', session: 'פגישה',
  nextMeetingReport: 'דוח לפגישה הבאה',
  report: 'דוח הכנה', letter: 'מכתב קליני',
  notifications: 'מרכז ההתראות', help: 'עזרה', calendar: 'יומן',
  settings: 'הגדרות', search: 'תוצאות חיפוש',
};

export const ALL_ROUTES = Object.keys(ROUTE_TITLES);
