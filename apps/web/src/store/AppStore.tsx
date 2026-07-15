// Sensei — central app store. React port of the prototype's DCLogic class:
// one global state object, setState-style patches, session persistence,
// theme + accessibility appliers, and global keyboard shortcuts.
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { initialState } from '../data/seed';
import { ROUTE_TITLES } from '../nav/navConfig';
import { pushRecent } from '../utils';
import { parseHash, routeToHash } from '../nav/urlHash';
import { clearSession, deleteAccount as deleteMockAccount, restoreSession } from '../services/mockAuth';
import { isApiConfigured } from '../services/apiClient';
import {
  clearApiAccessToken,
  ensureDemoApiAuth,
  getApiAccessToken,
  installApiAuthTokenProvider,
} from '../services/apiAuth';
import { loadPatientsWithFallback } from '../services/patients';
import { MOCK_PATIENTS, buildMockScheduledAppts } from '../data/mockPatients';
import { drainUploadQueue } from '../services/upload';
import { countPendingUploads } from '../services/uploadQueue';

const PKEY = 'sensei_session_react_v1';
const PERSIST_KEYS = [
  'view', 'authScreen', 'route', 'patientId', 'hasUploaded', 'settingsTab', 'a11y', 'profile',
  'notif', 'notifPrefs', 'twoFA', 'sessionTimeout', 'retainAudio',
  'notifRead', 'notifArchived', 'notifFilter', 'aiMessages', 'loginEmail', 'loginRemember',
  'patients', 'notesOverrides', 'scheduledAppts', 'sessionNotes', 'recentPatientIds', 'archivedPatients',
  'summaryEdits', 'summaryDrafts', 'notesDrafts',
  'patientsSize', 'notifGroupBy', 'theme', 'themePref',
  'deletedSessions', 'hiddenMeetingIds', 'demoMode',
  'transcriptsByPatient', 'activeTranscriptPatientId',
];

export type Patch = Record<string, any> | ((s: any) => Record<string, any>)

export interface AppStoreValue {
  S: any
  set: (patch: Patch) => void
  navigate: (route: string, patch?: Record<string, any>) => void
  toast: (msg: string, type?: string, action?: { label: string; onClick: () => void } | null) => void
  copyToClipboard: (text: string, okMsg: string) => void
  applyThemePref: (pref: 'system' | 'light' | 'dark') => void
  setA11y: (patch: Record<string, any>, toastMsg?: string) => void
  resetA11y: () => void
  pager: (items: any[], pageKey: string, sizeKey: string, options?: { sizes?: readonly number[]; showAbove?: number }) => { slice: any[]; view: any }
  logout: () => void
  deleteAccount: () => boolean
  // No-arg = the demo/legacy path (unchanged). With a user = credential/Google
  // sign-in: the signed-in identity flows into the profile so navigation,
  // avatars, and settings reflect the actual account.
  login: (user?: { name: string; email: string }) => void
}

const Ctx = createContext<AppStoreValue | null>(null);

export function useApp(): AppStoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppStoreProvider>');
  return v;
}

// ---- document-level appliers (html attributes the CSS keys off) ----
function applyThemeAttr(t: string) {
  const resolved = t === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', resolved);
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'theme-color'); document.head.appendChild(m); }
  // The browser-chrome color comes from the design system, not a literal:
  // read --bg AFTER data-theme is set so the token resolves per theme.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) m.setAttribute('content', bg);
}
function systemDark(): boolean {
  try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
}
export function resolveTheme(pref: string): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return systemDark() ? 'dark' : 'light';
}
function applyA11yAttrs(a: any) {
  const el = document.documentElement as any;
  a = a || {};
  const zoomMap: Record<string, number> = { small: 0.9, default: 1, large: 1.15, xlarge: 1.3 };
  el.style.zoom = String(zoomMap[a.textSize] || 1);
  el.setAttribute('data-a11y-contrast', a.contrast === 'high' ? 'high' : 'normal');
  el.setAttribute('data-a11y-motion', a.reduceMotion ? 'reduce' : 'normal');
  el.setAttribute('data-a11y-focus', a.strongFocus ? 'strong' : 'normal');
  el.setAttribute('data-a11y-reading', a.reading === 'spacious' ? 'spacious' : 'default');
  el.setAttribute('data-a11y-underline', a.underlineLinks ? 'on' : 'off');
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [S, setS] = useState<any>(() => initialState);
  const sRef = useRef(S); sRef.current = S;
  const timers = useRef<Record<string, any>>({});

  const set = useCallback((patch: Patch) => {
    setS((prev: any) => ({ ...prev, ...(typeof patch === 'function' ? (patch as any)(prev) : patch) }));
  }, []);

  const toast = useCallback((msg: string, type?: string, action?: any) => {
    set({ toast: { msg, type: type || 'success', action: action || null } });
    clearTimeout(timers.current.toast);
    timers.current.toast = setTimeout(() => set({ toast: null }), action ? 6000 : 2800);
  }, [set]);

  const navigate = useCallback((route: string, patch: Record<string, any> = {}) => {
    const needsLoad = ['patient', 'transcript', 'summary', 'report', 'meetingHistory', 'upcomingMeetings', 'session'].includes(route);
    set((s: any) => {
      const next: Record<string, any> = {
        route, ...patch, loading: needsLoad, transcriptSearch: '', navOpen: false,
        editingSummary: false, editingNotes: false, editingSessionNote: null,
      };
      if (route !== 'session') next.sessionNum = null;
      // Track engaged patients (most-recent-first) so the palette's "מטופלים אחרונים"
      // is genuinely recent, not the first N of the list.
      if (patch.patientId) next.recentPatientIds = pushRecent(s.recentPatientIds, patch.patientId);
      return next;
    });
    if (needsLoad) {
      clearTimeout(timers.current.load);
      timers.current.load = setTimeout(() => set({ loading: false }), 280);
    }
    window.scrollTo(0, 0);
    const m = document.getElementById('main-content');
    if (m) { m.scrollTop = 0; requestAnimationFrame(() => { try { (m as any).focus({ preventScroll: true }); } catch { /* noop */ } }); }
    document.title = 'סנסיי · ' + (ROUTE_TITLES[route] || 'סנסיי');
    // Keep the URL fragment in sync so every screen is deep-linkable and the
    // browser back button works. Same-value writes are skipped, so the
    // hashchange listener below never loops.
    const h = routeToHash(
      route,
      (patch.patientId as string) || sRef.current.patientId,
      (patch.sessionNum as number) ?? sRef.current.sessionNum,
    );
    if (window.location.hash !== h) window.location.hash = h;
  }, [set]);

  const copyToClipboard = useCallback((text: string, okMsg: string) => {
    const ok = () => toast(okMsg);
    const fail = () => { if (legacyCopy(text)) ok(); else toast('לא ניתן היה להעתיק ללוח. נסו שוב', 'error'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
      else fail();
    } catch { fail(); }
  }, [toast]);

  const applyThemePref = useCallback((pref: 'system' | 'light' | 'dark') => {
    const resolved = resolveTheme(pref);
    applyThemeAttr(resolved);
    set({ themePref: pref, theme: resolved });
  }, [set]);

  const setA11y = useCallback((patch: Record<string, any>, toastMsg?: string) => {
    const a = { ...sRef.current.a11y, ...patch };
    set({ a11y: a });
    applyA11yAttrs(a);
    if (toastMsg) toast(toastMsg);
  }, [set, toast]);

  const resetA11y = useCallback(() => {
    const a = { textSize: 'default', contrast: 'normal', reduceMotion: false, strongFocus: false, reading: 'default', underlineLinks: false };
    set({ a11y: a });
    applyA11yAttrs(a);
    toast('הגדרות הנגישות אופסו לברירת המחדל');
  }, [set, toast]);

  // Reusable list pagination (patients / sessions / patient meeting lists).
  const pager = useCallback((
    items: any[],
    pageKey: string,
    sizeKey: string,
    options?: { sizes?: readonly number[]; showAbove?: number },
  ) => {
    const st = sRef.current;
    const sizeChoices = options?.sizes ?? [6, 12, 24];
    const size = sizeChoices.includes(st[sizeKey]) ? st[sizeKey] : sizeChoices[0];
    const showAbove = options?.showAbove ?? 6;
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const cur = Math.min(Math.max(1, st[pageKey] || 1), pages);
    const start = (cur - 1) * size;
    const slice = items.slice(start, start + size);
    const go = (p: number) => {
      const np = Math.min(Math.max(1, p), pages);
      if (np !== cur) { set({ [pageKey]: np }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    };
    const setSize = (sz: number) => { if (sz !== size) set({ [sizeKey]: sz, [pageKey]: 1 }); };
    const seq: (number | string)[] = (() => {
      if (pages <= 7) { const a = []; for (let i = 1; i <= pages; i++) a.push(i); return a; }
      const s = new Set([1, pages, cur, cur - 1, cur + 1]);
      if (cur <= 3) { s.add(2); s.add(3); s.add(4); }
      if (cur >= pages - 2) { s.add(pages - 1); s.add(pages - 2); s.add(pages - 3); }
      const arr = [...s].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
      const out: (number | string)[] = []; let prev = 0;
      for (const n of arr) { if (n - prev > 1) out.push('…'); out.push(n); prev = n; }
      return out;
    })();
    const pageItems = seq.map((x) => x === '…'
      ? { gap: true, isPage: false }
      : {
          gap: false, isPage: true, n: String(x), active: x === cur, onClick: () => go(x as number),
          bg: x === cur ? 'var(--primary)' : 'var(--paper)', color: x === cur ? 'var(--paper)' : 'var(--text-2)',
          border: x === cur ? 'var(--primary)' : 'var(--divider)', weight: x === cur ? 700 : 600,
          ariaCurrent: x === cur ? ('page' as const) : undefined,
        });
    const sizeOpts = sizeChoices.map((sz) => ({
      n: String(sz), active: sz === size, onClick: () => setSize(sz),
      bg: sz === size ? 'var(--primary)' : 'var(--paper)', color: sz === size ? 'var(--paper)' : 'var(--text-2)', weight: sz === size ? 700 : 600,
    }));
    return {
      slice,
      view: {
        show: total > showAbove,
        rangeLabel: 'מציג ' + (start + 1) + '–' + Math.min(start + size, total) + ' מתוך ' + total,
        current: cur, totalPages: pages, pageItems, sizeOpts,
        onPrev: () => go(cur - 1), onNext: () => go(cur + 1), onFirst: () => go(1), onLast: () => go(pages),
        prevDisabled: cur <= 1, nextDisabled: cur >= pages,
        prevOpacity: cur <= 1 ? '.4' : '1', nextOpacity: cur >= pages ? '.4' : '1',
        prevCursor: cur <= 1 ? 'default' : 'pointer', nextCursor: cur >= pages ? 'default' : 'pointer',
      },
    };
  }, [set]);

  const syncPatients = useCallback((current: any[]) => {
    if (!isApiConfigured()) {
      set((s: any) => {
        const patch: Record<string, unknown> = {};
        if (!current.length) patch.patients = MOCK_PATIENTS.map((p) => ({ ...p }));
        if (!(s.scheduledAppts || []).length) patch.scheduledAppts = buildMockScheduledAppts();
        return patch;
      });
      return;
    }
    loadPatientsWithFallback(current).then(({ patients }) => {
      set((s: any) => {
        // Drop local mock schedule once the API is the source of truth.
        const patch: Record<string, unknown> = { patients, scheduledAppts: [] };
        const curId = s.patientId as string;
        if (!curId && patients.length) {
          patch.patientId = patients[0].id;
        } else if (curId && patients.length && !patients.some((p) => p.id === curId)) {
          const prev = current.find((p) => p.id === curId);
          if (prev) {
            const match = patients.find((p) => p.name === prev.name);
            if (match) patch.patientId = match.id;
            else patch.patientId = patients[0].id;
          } else {
            patch.patientId = patients[0].id;
          }
        }
        return patch;
      });
      if (patients.length === 0) {
        toast('לא ניתן לטעון מטופלים מהשרת', 'error');
      }
    });
  }, [set, toast]);

  const logout = useCallback(() => {
    clearSession(); // drop the mock-auth session record (localStorage + tab marker)
    clearApiAccessToken();
    set({ view: 'auth', authScreen: 'login', loginError: '', loginLoading: false, notifOpen: false, aiOpen: false, cmdOpen: false, dialog: null });
    document.title = 'סנסיי · כניסה';
    // Auth screens are state-driven by decision (no deep-link benefit for a
    // simulated login) — drop the app fragment so the URL doesn't name a
    // screen that is no longer shown.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [set]);

  const deleteAccount = useCallback((): boolean => {
    const sess = restoreSession();
    if (sess && 'user' in sess) {
      const result = deleteMockAccount(sess.user.id);
      if (result.ok === false) {
        if (result.error === 'seed-protected') toast('לא ניתן למחוק את חשבון ההדגמה', 'error');
        else toast('החשבון לא נמצא', 'error');
        return false;
      }
    } else {
      clearSession();
    }
    try { localStorage.removeItem(PKEY); } catch { /* storage unavailable */ }
    clearApiAccessToken();
    set({
      ...initialState,
      view: 'auth',
      authScreen: 'login',
      loginLoading: false,
      loginError: '',
      dialog: null,
      notifOpen: false,
      aiOpen: false,
      cmdOpen: false,
    });
    document.title = 'סנסיי · כניסה';
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  }, [set, toast]);

  const login = useCallback((user?: { name: string; email: string }) => {
    set((s: any) => {
      const patch: any = { view: 'app', route: 'dashboard', loginLoading: false, loginError: '' };
      if (user) {
        patch.profile = { ...s.profile, name: user.name, email: user.email };
        patch.profileDraft = { ...s.profileDraft, name: user.name, email: user.email };
        patch.loginEmail = user.email;
      }
      return patch;
    });
    document.title = 'סנסיי · ' + ROUTE_TITLES.dashboard;
    window.history.replaceState(null, '', routeToHash('dashboard'));
    syncPatients(sRef.current.patients);
  }, [set, syncPatients]);

  // ---- mount: restore persisted session, wire document/global listeners ----
  useEffect(() => {
    document.documentElement.setAttribute('lang', 'he');
    document.documentElement.setAttribute('dir', 'rtl');
    installApiAuthTokenProvider();
    let restored: any = null;
    try {
      const raw = localStorage.getItem(PKEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const patch: any = {};
        PERSIST_KEYS.forEach((k) => { if (saved[k] !== undefined) patch[k] = saved[k]; });
        // When the API is configured, patients/schedule come from the server — do not
        // rehydrate stale mock roster/appointments from a previous offline session.
        if (isApiConfigured()) {
          delete patch.patients;
          delete patch.archivedPatients;
          delete patch.scheduledAppts;
          delete patch.patientId;
        }
        // never restore transient/ephemeral UI
        patch.loading = false; patch.dialog = null; patch.toast = null; patch.cmdOpen = false;
        patch.notifOpen = false;
        if (patch.profile && patch.profile.gender === undefined) patch.profile = { ...patch.profile, gender: initialState.profile.gender };
        if (patch.profile) patch.profileDraft = { ...initialState.profile, ...patch.profile };
        restored = patch;
        set(patch);
        // gentle confirmation that the session followed the user across devices
        if (patch.route && patch.route !== 'dashboard' && patch.view !== 'auth') {
          timers.current.resume = setTimeout(() => toast('הסנכרון הושלם · ממשיכים מהמקום שהפסקתם', 'info'), 550);
        }
      }
    } catch { /* storage unavailable — continue with defaults */ }
    // Mock-auth session enforcement — applies ONLY when an explicit credential/
    // Google session record exists (demo and legacy sessions have none and keep
    // today's behavior). A non-remembered session from a previous browser
    // session is expired: land on the "expired" screen instead of the app.
    const authSess = restoreSession();
    if (authSess && 'expired' in authSess) {
      const demo = restored?.demoMode ?? sRef.current.demoMode;
      if (!demo && (restored?.view ?? sRef.current.view) !== 'auth') {
        clearSession();
        set({ view: 'auth', authScreen: 'expired' });
        restored = { ...(restored || {}), view: 'auth', authScreen: 'expired' };
      }
    }
    // Deep link overrides the persisted route so a shared/bookmarked URL opens
    // the exact screen it names (also what lets Playwright and manual testers
    // jump straight to any screen). It sets the route only — never the view: the
    // auth gate stays in charge of app-vs-auth, so a URL can't bypass sign-in.
    const deep = parseHash(window.location.hash);
    if (deep) {
      const dp: Record<string, any> = { route: deep.route };
      if (deep.patientId) dp.patientId = deep.patientId;
      if (deep.sessionNum != null) dp.sessionNum = deep.sessionNum;
      set(dp);
      restored = { ...(restored || {}), ...dp };
    }
    const pref = (restored && restored.themePref) || sRef.current.themePref;
    applyThemePref(pref);
    applyA11yAttrs((restored && restored.a11y) || sRef.current.a11y);
    const st0 = restored || sRef.current;
    document.title = st0.view === 'auth' ? 'סנסיי · כניסה' : 'סנסיי · ' + (ROUTE_TITLES[st0.route] || 'סנסיי');
    // Normalize the fragment to the screen actually shown (replace — no history entry).
    if (st0.view !== 'auth') window.history.replaceState(null, '', routeToHash(st0.route, st0.patientId, st0.sessionNum));
    const startPatientSync = () => syncPatients(st0.patients || []);
    if (st0.view === 'app') {
      // Any restored app session needs a live API token when the backend is wired —
      // not just demo mode, so a persisted session sources real data (not the demo
      // fallback) after a reload. No-ops when a token already exists.
      if (isApiConfigured() && !getApiAccessToken()) {
        void ensureDemoApiAuth().finally(startPatientSync);
      } else {
        startPatientSync();
      }
    }
    const timersRef = timers.current;

    // connection awareness + offline upload sync
    set({ online: navigator.onLine !== false });
    countPendingUploads().then((n) => set({ pendingUploadCount: n }));
    const onOnline = () => {
      set({ online: true });
      drainUploadQueue({ online: true }).then(({ synced, last }) => {
        countPendingUploads().then((n) => set({ pendingUploadCount: n }));
        if (synced > 0) {
          if (last?.transcript && last.patientId) {
            set((s: any) => ({
              transcriptsByPatient: {
                ...(s.transcriptsByPatient || {}),
                [last.patientId]: {
                  audioId: last.audioId || '',
                  text: last.transcript!.text,
                  language: last.transcript!.language,
                  createdAt: new Date().toISOString(),
                  meetingId: last.transcript!.meetingId,
                  transcriptId: last.transcript!.transcriptId,
                },
              },
              activeTranscriptPatientId: last.patientId,
              hasUploaded: true,
            }));
          } else {
            set({ hasUploaded: true });
          }
          toast(`סונכרנו ${synced} הקלטות`, 'success');
        } else {
          toast('החיבור חזר · מסנכרן את העבודה שלכם', 'success');
        }
      });
    };
    const onOffline = () => set({ online: false });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Browser history / hand-edited fragments: back-forward re-applies the
    // screen through navigate() (same skeleton/title/scroll behavior as any
    // in-app navigation); an invalid fragment is normalized, never applied.
    const onHash = () => {
      const st = sRef.current;
      if (st.view !== 'app') return; // auth is state-driven; deep links are app-only
      const p = parseHash(window.location.hash);
      if (!p) {
        window.history.replaceState(null, '', routeToHash(st.route, st.patientId, st.sessionNum));
        return;
      }
      const sameRoute = p.route === st.route;
      const samePatient = !p.patientId || p.patientId === st.patientId;
      const sameSession = p.sessionNum == null || p.sessionNum === st.sessionNum;
      if (sameRoute && samePatient && sameSession) return;
      navigate(p.route, {
        ...(p.patientId ? { patientId: p.patientId } : {}),
        ...(p.sessionNum != null ? { sessionNum: p.sessionNum } : {}),
      });
    };
    window.addEventListener('hashchange', onHash);

    // live system-theme tracking while pref = system
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSystemTheme = () => {
      if (sRef.current.themePref === 'system') {
        const resolved = resolveTheme('system');
        applyThemeAttr(resolved);
        set({ theme: resolved });
      }
    };
    if (mq && mq.addEventListener) mq.addEventListener('change', onSystemTheme);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('hashchange', onHash);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onSystemTheme);
      // `timers` ref holds one stable object for the component's lifetime, so
      // reading it here clears whatever timers are pending at unmount.
      Object.values(timersRef).forEach((t) => { clearTimeout(t); clearInterval(t); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- debounced session persistence (cross-device continuity) ----
  const lastSig = useRef('');
  useEffect(() => {
    const sig = JSON.stringify(PERSIST_KEYS.map((k) => S[k]));
    if (sig === lastSig.current) return;
    if (!lastSig.current) { lastSig.current = sig; return; } // skip initial
    lastSig.current = sig;
    clearTimeout(timers.current.persist);
    timers.current.persist = setTimeout(() => {
      try {
        const out: any = { __savedAt: Date.now() };
        PERSIST_KEYS.forEach((k) => { out[k] = sRef.current[k]; });
        localStorage.setItem(PKEY, JSON.stringify(out));
      } catch { /* storage unavailable */ }
    }, 500);
  }, [S]);

  // ---- global keyboard shortcuts (Escape cascade, ⌘K, ?, /, N, G) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = sRef.current;
      if (e.key === 'Escape') {
        if (st.navOpen) { set({ navOpen: false }); return; }
        if (st.shortcutsOpen) { set({ shortcutsOpen: false }); return; }
        if (st.cmdOpen) { set({ cmdOpen: false, cmdInput: '' }); return; }
        if (st.notifOpen) { set({ notifOpen: false }); return; }
        if (st.aiOpen) { set({ aiOpen: false }); return; }
        if (st.dialog) { set({ dialog: null, errors: {}, calEventDetail: null }); return; }
        if (st.toast) set({ toast: null });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        set((s: any) => ({ cmdOpen: !s.cmdOpen, cmdInput: '', cmdIndex: 0 }));
        return;
      }
      const tag = ((e.target as any)?.tagName as string) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as any)?.isContentEditable;
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && st.view === 'app' && !st.dialog) {
        if (e.key === '?') { e.preventDefault(); set((s: any) => ({ shortcutsOpen: !s.shortcutsOpen })); return; }
        if (st.shortcutsOpen) return;
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          set({ upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
          navigate('upload');
          return;
        }
        if (e.key === 'g' || e.key === 'G') { e.preventDefault(); navigate('dashboard'); }
      }
    };
    // a11y: Enter/Space activate role="button" elements that aren't native buttons
    const a11yActivate = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      const t = e.target as HTMLElement;
      if (!t || t.nodeType !== 1 || typeof t.getAttribute !== 'function') return;
      if (t.getAttribute('role') !== 'button') return;
      const tag = t.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (t.getAttribute('aria-disabled') === 'true') return;
      e.preventDefault();
      t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', a11yActivate);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', a11yActivate);
    };
  }, [set, navigate]);

  // ---- a11y: promote pointer targets to focusable role="button" (WCAG 2.1.1) ----
  useEffect(() => {
    let raf: any = null;
    const promote = () => {
      const nodes = document.querySelectorAll<HTMLElement>('[style*="cursor"]');
      nodes.forEach((el) => {
        if (!el.style || el.style.cursor !== 'pointer') return;
        const tag = el.tagName;
        if (tag === 'A') { if (el.getAttribute('href')) return; }
        else if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY', 'OPTION'].includes(tag)) return;
        if (el.hasAttribute('role') || el.hasAttribute('tabindex')) return;
        if (el.getAttribute('aria-hidden') === 'true') return;
        // Don't promote a container that holds (or sits inside) another interactive
        // element — a role="button" wrapping/inside another control is a WCAG 4.1.2
        // "nested interactive" violation. Its inner control stays keyboard-operable.
        // `tabindex="-1"` is EXCLUDED: it's a programmatic focus target (e.g. the
        // #main-content route-focus landmark), not a keyboard-reachable control —
        // counting it here silently defeated promotion for every click-only card
        // inside <main> (they all sit inside #main-content[tabindex="-1"]).
        const INTERACTIVE = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
        if (el.querySelector(INTERACTIVE)) return;
        if (el.parentElement && el.parentElement.closest(INTERACTIVE)) return;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
      });
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; promote(); });
    };
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
    promote();
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const value = useMemo<AppStoreValue>(() => ({
    S, set, navigate, toast, copyToClipboard, applyThemePref, setA11y, resetA11y, pager, logout, deleteAccount, login,
  }), [S, set, navigate, toast, copyToClipboard, applyThemePref, setA11y, resetA11y, pager, logout, deleteAccount, login]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
