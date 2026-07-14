// URL-hash routing — canonical two-way mapping between the store's state-driven
// route and a shareable URL fragment. Hash-based by decision (see CHANGELOG
// 1.0.61): this is a client-only SPA on static hosting, so the fragment gives
// deep linking, bookmarking, browser history and Playwright-navigable screens
// with ZERO server rewrite config and no router dependency. Overlays, dialogs
// and sub-tabs stay state-driven on purpose — transient UI earns no URL.
import { ALL_ROUTES } from './navConfig';

// Routes whose meaning depends on the selected patient — the id is part of the
// deep link (`#/patient/p3`), so a shared URL opens the same file.
export const PATIENT_ROUTES = ['patient', 'transcript', 'summary', 'meetingHistory', 'upcomingMeetings', 'report', 'letter'];

const SESSION_NUM_RE = /^[1-9]\d{0,3}$/;

// Conservative id shape: seed ids (p1…) and future backend ids, never markup.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function routeToHash(route: string, patientId?: string, sessionNum?: number): string {
  if (!ALL_ROUTES.includes(route)) return '#/dashboard';
  if (route === 'session' && patientId && ID_RE.test(patientId) && sessionNum != null && sessionNum > 0) {
    return `#/session/${patientId}/${sessionNum}`;
  }
  if (PATIENT_ROUTES.includes(route) && patientId && ID_RE.test(patientId)) {
    return `#/${route}/${patientId}`;
  }
  return `#/${route}`;
}

export function parseHash(hash: string): { route: string; patientId?: string; sessionNum?: number } | null {
  const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const route = parts[0];
  if (!ALL_ROUTES.includes(route)) return null;
  if (route === 'session') {
    if (parts.length !== 3 || !ID_RE.test(parts[1]) || !SESSION_NUM_RE.test(parts[2])) return null;
    return { route, patientId: parts[1], sessionNum: parseInt(parts[2], 10) };
  }
  if (parts.length >= 2) {
    if (parts.length > 2) return null;
    if (!PATIENT_ROUTES.includes(route) || !ID_RE.test(parts[1])) return null;
    return { route, patientId: parts[1] };
  }
  return { route };
}
