// Frontend-only mock authentication provider (design-reference scope).
// This is the SWAP SEAM for a real backend: the UI and store consume only this
// module's interface, so replacing it with real endpoints (via apiClient) needs
// no UI changes. Everything here is deliberately mock-grade and honest about it:
// users live in localStorage, "hashing" is obfuscation (djb2) so plaintext
// passwords are never stored, and no network is ever touched.
//
// Identity is EMAIL-ONLY by decision: the existing sign-in UX authenticates by
// דוא״ל and the product has no username concept — so no username field/dup-check.
import { EMAIL_RE } from '../utils';

export type MockProvider = 'password' | 'google'

export interface MockUser {
  id: string
  name: string
  email: string
  provider: MockProvider
  createdAt: number
}

interface StoredUser extends MockUser {
  passHash?: string // absent for google users
}

interface StoredSession {
  userId: string
  provider: MockProvider
  remember: boolean
  createdAt: number
}

export type RegisterError = 'invalid-name' | 'invalid-email' | 'weak-password' | 'email-exists'
export type LoginError = 'not-found' | 'wrong-password'

const USERS_KEY = 'sensei_mock_users_v1';
const SESSION_KEY = 'sensei_auth_session_v1';
// A sessionStorage marker scopes non-"remember me" sessions to the browser
// session: present → same session; absent on restore → treat as expired.
const TAB_MARK = 'sensei_auth_tab_v1';

export const MIN_PASSWORD = 8;

// Mock-grade one-way obfuscation (djb2 + length). NOT cryptography — it only
// guarantees we never persist a plaintext password. A real backend replaces
// this module wholesale.
function hash(pw: string): string {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36) + '.' + pw.length;
}

function safeGet(store: Storage, key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store: Storage, key: string, value: string): void {
  try { store.setItem(key, value); } catch { /* storage unavailable — mock auth degrades to in-memory-less */ }
}
function safeRemove(store: Storage, key: string): void {
  try { store.removeItem(key); } catch { /* ignore */ }
}

// The canonical demo clinician — matches the prefilled login form and the
// seeded profile (data/seed.ts), so the shipped credentials work with zero
// setup. Merged virtually on read (storage stays clean until a write happens);
// the demo password is public demo data by design, never a secret, and even it
// is only ever persisted as a hash.
const SEED_USER: StoredUser = {
  id: 'mu_seed_rotem', name: 'ד״ר רותם שגב', email: 'rotem@clinic.co.il',
  provider: 'password', createdAt: 0, passHash: hash('demo1234'),
};

function listUsers(): StoredUser[] {
  let users: StoredUser[];
  try { users = JSON.parse(safeGet(localStorage, USERS_KEY) || '[]'); } catch { users = []; }
  if (!Array.isArray(users)) users = [];
  if (!users.some((u) => u.email === SEED_USER.email)) users = [SEED_USER, ...users];
  return users;
}
function saveUsers(users: StoredUser[]): void {
  safeSet(localStorage, USERS_KEY, JSON.stringify(users));
}

const publicUser = ({ passHash: _ph, ...u }: StoredUser): MockUser => u;

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

// Password strength for the signup meter: 0 = too short, 1 = weak, 2 = good, 3 = strong.
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw || pw.length < MIN_PASSWORD) return 0;
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  if (pw.length >= 12 && classes >= 3) return 3;
  if (classes >= 2) return 2;
  return 1;
}

export function register(input: { name: string; email: string; password: string }):
  | { ok: true; user: MockUser }
  | { ok: false; error: RegisterError } {
  const name = (input.name || '').trim();
  const email = normalizeEmail(input.email);
  if (name.length < 2) return { ok: false, error: 'invalid-name' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid-email' };
  if ((input.password || '').length < MIN_PASSWORD) return { ok: false, error: 'weak-password' };
  const users = listUsers();
  if (users.some((u) => u.email === email)) return { ok: false, error: 'email-exists' };
  const user: StoredUser = {
    id: 'mu_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    name, email, provider: 'password', createdAt: Date.now(), passHash: hash(input.password),
  };
  saveUsers([...users, user]);
  return { ok: true, user: publicUser(user) };
}

export function login(email: string, password: string):
  | { ok: true; user: MockUser }
  | { ok: false; error: LoginError } {
  const users = listUsers();
  const u = users.find((x) => x.email === normalizeEmail(email));
  if (!u) return { ok: false, error: 'not-found' };
  if (u.provider === 'google' || !u.passHash || u.passHash !== hash(password || '')) {
    return { ok: false, error: 'wrong-password' };
  }
  return { ok: true, user: publicUser(u) };
}

// Simulated Google sign-in: one canonical mock Google identity, created on
// first use and reused after (so it behaves like the same account each time).
export function googleSignIn(): { ok: true; user: MockUser } {
  const email = 'rotem.segev@gmail.com';
  const users = listUsers();
  let u = users.find((x) => x.email === email);
  if (!u) {
    u = { id: 'mu_google_demo', name: 'ד״ר רותם שגב', email, provider: 'google', createdAt: Date.now() };
    saveUsers([...users, u]);
  }
  return { ok: true, user: publicUser(u) };
}

// Reset flow. requestReset never reveals whether the email exists (no user
// enumeration — the confirmation screen reads the same either way); the mock
// reset step then only succeeds for a real registered password account.
export function requestReset(email: string): { ok: true } {
  void normalizeEmail(email);
  return { ok: true };
}

export function resetPassword(email: string, newPassword: string):
  | { ok: true }
  | { ok: false; error: 'not-found' | 'weak-password' } {
  if ((newPassword || '').length < MIN_PASSWORD) return { ok: false, error: 'weak-password' };
  const users = listUsers();
  const i = users.findIndex((x) => x.email === normalizeEmail(email) && x.provider === 'password');
  if (i === -1) return { ok: false, error: 'not-found' };
  users[i] = { ...users[i], passHash: hash(newPassword) };
  saveUsers(users);
  return { ok: true };
}

// ---- session ----

export function createSession(user: MockUser, remember: boolean): void {
  const s: StoredSession = { userId: user.id, provider: user.provider, remember, createdAt: Date.now() };
  safeSet(localStorage, SESSION_KEY, JSON.stringify(s));
  if (!remember) safeSet(sessionStorage, TAB_MARK, '1');
}

// null = no auth record (legacy/demo sessions — caller keeps today's behavior).
// { expired: true } = a non-remembered session from a previous browser session.
export function restoreSession(): { user: MockUser } | { expired: true } | null {
  let s: StoredSession | null = null;
  try { s = JSON.parse(safeGet(localStorage, SESSION_KEY) || 'null'); } catch { s = null; }
  if (!s || !s.userId) return null;
  if (!s.remember && !safeGet(sessionStorage, TAB_MARK)) return { expired: true };
  const u = listUsers().find((x) => x.id === s!.userId);
  if (!u) return { expired: true };
  return { user: publicUser(u) };
}

export function clearSession(): void {
  safeRemove(localStorage, SESSION_KEY);
  safeRemove(sessionStorage, TAB_MARK);
}

export type DeleteAccountError = 'not-found' | 'seed-protected'

function storedUsers(): StoredUser[] {
  try {
    const users = JSON.parse(safeGet(localStorage, USERS_KEY) || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

// Permanently removes a registered mock account and clears its session.
// The canonical demo seed account cannot be deleted (it is merged virtually on read).
export function deleteAccount(userId: string):
  | { ok: true }
  | { ok: false; error: DeleteAccountError } {
  if (userId === SEED_USER.id) return { ok: false, error: 'seed-protected' };
  const users = storedUsers();
  if (!users.some((u) => u.id === userId)) return { ok: false, error: 'not-found' };
  saveUsers(users.filter((u) => u.id !== userId));
  clearSession();
  return { ok: true };
}
