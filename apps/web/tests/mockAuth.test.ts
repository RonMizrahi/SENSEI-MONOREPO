// Mock-auth provider (`src/services/mockAuth.ts`) — the frontend-only auth seam.
// Locks the contract the auth screens depend on: registration with duplicate
// detection, credential login, no-plaintext-password storage, the Google mock,
// the reset flow, and Remember-Me session semantics (session-scoped expiry).
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD, clearSession, createSession, deleteAccount, googleSignIn, login,
  passwordStrength, register, requestReset, resetPassword, restoreSession,
} from '../src/services/mockAuth';

const USER = { name: 'ד״ר נועה כהן', email: 'Noa@Clinic.co.il', password: 'sunlight-42' };

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('registration', () => {
  it('registers a user and normalizes the email', () => {
    const r = register(USER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.email).toBe('noa@clinic.co.il');
  });
  it('rejects duplicates, bad emails, short names, weak passwords — each with its own error', () => {
    expect(register(USER).ok).toBe(true);
    expect(register(USER)).toEqual({ ok: false, error: 'email-exists' });
    expect(register({ ...USER, email: 'not-an-email' })).toEqual({ ok: false, error: 'invalid-email' });
    expect(register({ ...USER, email: 'x@y.z', name: 'א' })).toEqual({ ok: false, error: 'invalid-name' });
    expect(register({ ...USER, email: 'x@y.z', password: 'short' })).toEqual({ ok: false, error: 'weak-password' });
  });
  it('never stores the plaintext password anywhere in storage', () => {
    register(USER);
    expect(JSON.stringify(localStorage)).not.toContain(USER.password);
  });
});

describe('login', () => {
  it('the shipped demo credentials work with zero setup (prefilled form path)', () => {
    expect(login('rotem@clinic.co.il', 'demo1234').ok).toBe(true);
    expect(login('rotem@clinic.co.il', 'wrong-pass')).toEqual({ ok: false, error: 'wrong-password' });
    expect(register({ name: 'מתחזה', email: 'rotem@clinic.co.il', password: 'whatever-99' }))
      .toEqual({ ok: false, error: 'email-exists' }); // seed account is duplicate-protected
  });
  it('accepts the registered credentials (case-insensitive email) and rejects wrong ones', () => {
    register(USER);
    const ok = login('NOA@clinic.co.il', USER.password);
    expect(ok.ok).toBe(true);
    expect(login(USER.email, 'wrong-password-1')).toEqual({ ok: false, error: 'wrong-password' });
    expect(login('nobody@nowhere.com', USER.password)).toEqual({ ok: false, error: 'not-found' });
  });
  it('supports multiple registered users independently', () => {
    register(USER);
    register({ name: 'ד״ר דן לוי', email: 'dan@clinic.co.il', password: 'moonrise-77' });
    expect(login('dan@clinic.co.il', 'moonrise-77').ok).toBe(true);
    expect(login('noa@clinic.co.il', 'moonrise-77').ok).toBe(false);
  });
});

describe('google mock', () => {
  it('signs in with a stable mock identity and reuses it on repeat sign-ins', () => {
    const a = googleSignIn(); const b = googleSignIn();
    expect(a.user.id).toBe(b.user.id);
    expect(a.user.provider).toBe('google');
  });
  it('a google account cannot be logged into with a password', () => {
    const g = googleSignIn();
    expect(login(g.user.email, 'anything-at-all')).toEqual({ ok: false, error: 'wrong-password' });
  });
});

describe('password reset', () => {
  it('request never discloses account existence; reset changes the password for real accounts only', () => {
    register(USER);
    expect(requestReset('whoever@anywhere.com')).toEqual({ ok: true }); // no enumeration
    expect(resetPassword('noa@clinic.co.il', 'new-password-9')).toEqual({ ok: true });
    expect(login('noa@clinic.co.il', USER.password).ok).toBe(false); // old password dead
    expect(login('noa@clinic.co.il', 'new-password-9').ok).toBe(true);
    expect(resetPassword('nobody@nowhere.com', 'new-password-9')).toEqual({ ok: false, error: 'not-found' });
    expect(resetPassword('noa@clinic.co.il', 'short')).toEqual({ ok: false, error: 'weak-password' });
  });
});

describe('sessions & remember me', () => {
  it('a remembered session survives a "browser restart" (sessionStorage wiped)', () => {
    const r = register(USER); if (!r.ok) throw new Error('setup');
    createSession(r.user, true);
    sessionStorage.clear(); // simulate browser restart
    const restored = restoreSession();
    expect(restored && 'user' in restored && restored.user.email).toBe('noa@clinic.co.il');
  });
  it('a non-remembered session expires when the browser session ends', () => {
    const r = register(USER); if (!r.ok) throw new Error('setup');
    createSession(r.user, false);
    expect(restoreSession() && 'user' in (restoreSession() as any)).toBe(true); // same session: alive
    sessionStorage.clear(); // browser restart
    expect(restoreSession()).toEqual({ expired: true });
  });
  it('logout clears everything; absent record returns null (legacy/demo sessions untouched)', () => {
    const r = register(USER); if (!r.ok) throw new Error('setup');
    createSession(r.user, true);
    clearSession();
    expect(restoreSession()).toBeNull();
  });
});

describe('password strength meter', () => {
  it('scores 0 below the minimum, then by character-class variety', () => {
    expect(passwordStrength('short')).toBe(0);
    expect(passwordStrength('a'.repeat(MIN_PASSWORD))).toBe(1);
    expect(passwordStrength('abcdef12')).toBe(2);
    expect(passwordStrength('Abcdef12!xyz')).toBe(3);
  });
});

describe('delete account', () => {
  it('removes a registered user and clears the session', () => {
    const r = register(USER);
    if (!r.ok) throw new Error('setup');
    createSession(r.user, true);
    expect(deleteAccount(r.user.id)).toEqual({ ok: true });
    expect(restoreSession()).toBeNull();
    expect(login(USER.email, USER.password)).toEqual({ ok: false, error: 'not-found' });
  });
  it('protects the canonical demo seed account from deletion', () => {
    expect(deleteAccount('mu_seed_rotem')).toEqual({ ok: false, error: 'seed-protected' });
  });
  it('returns not-found for unknown user ids', () => {
    expect(deleteAccount('mu_does_not_exist')).toEqual({ ok: false, error: 'not-found' });
  });
});
