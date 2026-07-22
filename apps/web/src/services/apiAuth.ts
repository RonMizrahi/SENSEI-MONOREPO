// Backend API auth (Bearer token for senseiapi when ENABLE_SECURITY=true).
// Separate from mockAuth (localStorage UI session) — demo mode may have an API
// token without a mock-auth session record.
import { API_BASE_URL, isApiConfigured, setAuthTokenProvider } from './apiClient';

const TOKEN_KEY = 'sensei_api_access_token_v1';

/** Matches the seeded mock clinician (AuthScreens / mockAuth). */
export const DEMO_API_EMAIL = 'rotem@clinic.co.il';
export const DEMO_API_PASSWORD = 'demo1234';
export const DEMO_API_NAME = 'ד״ר רותם שגב';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string, opts: { remember: boolean }): void {
  try {
    if (opts.remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch { /* storage unavailable */ }
}

/** Best-effort server-side logout (POST /auth/logout bumps token_version so the
 *  Bearer token is invalidated everywhere, not just cleared locally). Fire-and-
 *  forget: local sign-out must never block on the network. */
export function apiLogoutBestEffort(): void {
  const token = readToken();
  if (!isApiConfigured() || !token) return;
  const url = API_BASE_URL + '/auth/logout';
  const init: RequestInit = {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
    keepalive: true,
  };
  void fetch(url, init).catch(() => { /* offline/expired — local clear is sufficient */ });
}

export function clearApiAccessToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
  installApiAuthTokenProvider();
}

/** Wire apiClient to the stored token (call once on app boot). */
export function installApiAuthTokenProvider(): void {
  setAuthTokenProvider(() => readToken());
}

export function getApiAccessToken(): string | null {
  return readToken();
}

async function registerDemoUser(): Promise<void> {
  const url = API_BASE_URL + '/auth/register';
  const init: RequestInit = {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: DEMO_API_EMAIL,
      password: DEMO_API_PASSWORD,
      full_name: DEMO_API_NAME,
    }),
  };
  const res = await fetch(url, init);
  // 409 = already registered — fine for idempotent demo entry.
  if (res.ok || res.status === 409) return;
  // Other errors: leave for token step / caller.
}

async function requestAccessToken(email: string, password: string): Promise<string> {
  const body = new URLSearchParams();
  body.set('username', email);
  body.set('password', password);
  const url = API_BASE_URL + '/auth/token';
  const init: RequestInit = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  };
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('missing access_token');
  return data.access_token;
}

/**
 * Ensure the demo clinician exists on the API and store a Bearer token so
 * secured endpoints stop returning 401 in demo mode.
 *
 * No-ops when the API is not configured. If security is off and /patients
 * already accepts anonymous access, returns true without a token.
 */
export async function ensureDemoApiAuth(): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    const probe = await fetch(API_BASE_URL + '/patients', {
      headers: { Accept: 'application/json' },
    });
    if (probe.ok) {
      installApiAuthTokenProvider();
      return true;
    }
  } catch {
    // Network error — still try register/token below.
  }
  try {
    await registerDemoUser();
    const token = await requestAccessToken(DEMO_API_EMAIL, DEMO_API_PASSWORD);
    writeToken(token, { remember: true });
    installApiAuthTokenProvider();
    return true;
  } catch {
    installApiAuthTokenProvider();
    return false;
  }
}
