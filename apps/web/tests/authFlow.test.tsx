// Auth entry form + session teardown — the login screen's client-side validation and
// the logout behaviour. These are user-visible, security-relevant flows (the app's
// front door) that were previously only smoke-rendered. All behaviour is exercised
// through the real store + components; no backend, no live API, no timers advanced.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); });

const emailInput = () => document.querySelector('input[autocomplete="email"]') as HTMLInputElement;
const passInput = () => document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
const loginBtn = () => document.querySelector('.auth-login-btn') as HTMLButtonElement;
const alertText = () => document.querySelector('[role="alert"]')?.textContent || '';

async function openLogin() {
  mount({ view: 'auth', authScreen: 'login' });
  await settle();
  await waitFor(() => expect(loginBtn()).toBeTruthy());
}

describe('login form — client-side validation & accessible errors', () => {
  it('rejects a malformed email with a specific, announced error', async () => {
    await openLogin();
    fireEvent.input(emailInput(), { target: { value: 'not-an-email' } });
    fireEvent.input(passInput(), { target: { value: '123456' } });
    fireEvent.click(loginBtn());
    await settle();
    // announced via role="alert", with the exact copy, and the fields marked invalid
    expect(alertText()).toContain('הזינו כתובת דוא״ל תקינה');
    expect(emailInput().getAttribute('aria-invalid')).toBe('true');
    // does NOT proceed to loading
    expect(loginBtn().getAttribute('aria-busy')).not.toBe('true');
  });

  it('rejects a too-short password (valid email) with the length message', async () => {
    await openLogin();
    fireEvent.input(emailInput(), { target: { value: 'therapist@clinic.co.il' } });
    fireEvent.input(passInput(), { target: { value: '123' } });
    fireEvent.click(loginBtn());
    await settle();
    expect(alertText()).toContain('הסיסמה חייבת לכלול לפחות 6 תווים');
  });

  it('valid credentials enter the loading submit state (button disabled + aria-busy)', async () => {
    await openLogin();
    fireEvent.input(emailInput(), { target: { value: 'therapist@clinic.co.il' } });
    fireEvent.input(passInput(), { target: { value: 'secret1' } });
    fireEvent.click(loginBtn());
    await settle();
    expect(loginBtn().disabled).toBe(true);
    expect(loginBtn().getAttribute('aria-busy')).toBe('true');
    // no validation error is shown on the valid path
    expect(document.querySelector('[role="alert"]')).toBeFalsy();
  });

  it('submits via the Enter key (keyboard-only usage)', async () => {
    await openLogin();
    fireEvent.input(emailInput(), { target: { value: 'bad' } });
    fireEvent.keyDown(passInput(), { key: 'Enter' });
    await settle();
    // Enter ran the same validation path → the email error is announced
    expect(alertText()).toContain('הזינו כתובת דוא״ל תקינה');
  });
});

describe('logout — session teardown returns to the login screen and clears transient UI', () => {
  it('logging out from the app exits to login and closes open overlays', async () => {
    // start logged in, on the dashboard, with the notifications overlay open
    mount({ view: 'app', route: 'dashboard', notifOpen: true });
    await settle();
    // sanity: we are in the app (no login button yet)
    expect(loginBtn()).toBeFalsy();

    const logout = document.querySelector('[aria-label="התנתקות מהמערכת"]') as HTMLElement;
    expect(logout, 'logout control is present in the app chrome').toBeTruthy();
    fireEvent.click(logout);
    await settle();

    // back at the login screen…
    await waitFor(() => expect(loginBtn()).toBeTruthy());
    // …and the previously-open notifications overlay is gone (transient UI reset)
    expect(document.querySelector('.appbar-popover-panel')).toBeFalsy();
  });
});
