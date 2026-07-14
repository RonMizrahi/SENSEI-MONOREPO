// Mock-auth UI flows — the frontend-only authentication experience end-to-end
// through the real store + screens: credential rejection/acceptance against the
// mock user store, registration (validation → duplicate → success), the mock
// Google sign-in, the forgot → reset → done flow, and the demo path staying
// exactly as it was. Timers run for real (850–1100ms), so waits are generous.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { createSession, login as authLogin } from '../src/services/mockAuth';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = (ms = 80) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

const emailInput = () => document.querySelector('input[autocomplete="email"]') as HTMLInputElement;
const passInput = () => document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
const loginBtn = () => document.querySelector('.auth-login-btn') as HTMLButtonElement;
const alertText = () => document.querySelector('[role="alert"]')?.textContent || '';

async function openLogin() {
  mount({ view: 'auth', authScreen: 'login' });
  await settle();
  await waitFor(() => expect(loginBtn()).toBeTruthy());
}
async function submitLogin(email: string, pass: string) {
  fireEvent.input(emailInput(), { target: { value: email } });
  fireEvent.input(passInput(), { target: { value: pass } });
  fireEvent.click(loginBtn());
  await settle(1000); // ride out the simulated 850ms auth delay
}

describe('credential login — validated against the mock user store', () => {
  it('an unknown account is rejected with the not-found error (stays on login)', async () => {
    await openLogin();
    await submitLogin('nobody@nowhere.com', 'whatever-99');
    expect(alertText()).toContain('לא נמצא חשבון');
    expect(loginBtn(), 'still on the login screen').toBeTruthy();
  });

  it('a wrong password on the shipped demo account is rejected', async () => {
    await openLogin();
    await submitLogin('rotem@clinic.co.il', 'wrong-pass-1');
    expect(alertText()).toContain('הסיסמה שגויה');
  });

  it('the shipped demo credentials sign in (prefilled-form happy path)', async () => {
    await openLogin();
    await submitLogin('rotem@clinic.co.il', 'demo1234');
    await waitFor(() => expect(loginBtn()).toBeFalsy());
    // a credential session record now exists (remember-me default on → localStorage)
    expect(localStorage.getItem('sensei_auth_session_v1')).toBeTruthy();
  });
});

describe('registration — full validation, duplicates, then a working account', () => {
  const field = (label: string) => document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  const signupBtn = () => document.querySelector('.auth-signup-btn') as HTMLButtonElement;

  async function openSignup() {
    mount({ view: 'auth', authScreen: 'signup' });
    await settle();
    await waitFor(() => expect(signupBtn()).toBeTruthy());
  }
  function fill(name: string, email: string, pass: string, confirm = pass) {
    fireEvent.input(field('שם מלא'), { target: { value: name } });
    fireEvent.input(field('דוא״ל'), { target: { value: email } });
    fireEvent.input(field('סיסמה'), { target: { value: pass } });
    fireEvent.input(field('אימות סיסמה'), { target: { value: confirm } });
  }
  const terms = () => document.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement;

  it('walks the validation ladder: short password → mismatch → terms → duplicate email', async () => {
    await openSignup();
    fill('ד״ר נועה כהן', 'noa@clinic.co.il', 'short');
    fireEvent.click(signupBtn()); await settle();
    expect(alertText()).toContain('לפחות 8 תווים');

    fill('ד״ר נועה כהן', 'noa@clinic.co.il', 'sunlight-42', 'different-42');
    fireEvent.click(signupBtn()); await settle();
    expect(alertText()).toContain('אימות הסיסמה אינו תואם');

    fill('ד״ר נועה כהן', 'noa@clinic.co.il', 'sunlight-42');
    fireEvent.click(signupBtn()); await settle();
    expect(alertText()).toContain('תנאי השימוש');

    fireEvent.click(terms());
    fill('מתחזה כלשהו', 'rotem@clinic.co.il', 'sunlight-42'); // seed account's email
    fireEvent.click(signupBtn()); await settle(1000);
    expect(alertText()).toContain('כבר רשומה');
  });

  it('a valid registration creates a persistent account that can log in later', async () => {
    await openSignup();
    fill('ד״ר נועה כהן', 'noa@clinic.co.il', 'sunlight-42');
    fireEvent.click(terms());
    fireEvent.click(signupBtn());
    await settle(1000);
    await waitFor(() => expect(signupBtn()).toBeFalsy()); // entered the app
    // the registered credentials are real: the service accepts them afterwards
    expect(authLogin('noa@clinic.co.il', 'sunlight-42').ok).toBe(true);
    // and the signed-in identity reached the persisted profile
    const saved = JSON.parse(localStorage.getItem(PKEY) || '{}');
    await waitFor(() => {
      const now = JSON.parse(localStorage.getItem(PKEY) || '{}');
      expect((now.profile || saved.profile || {}).name).toBe('ד״ר נועה כהן');
    });
  });
});

describe('google sign-in (simulated) — loading then success', () => {
  it('clicking the Google button signs in with the mock Google identity', async () => {
    await openLogin();
    const gBtn = document.querySelector('.auth-google-btn') as HTMLButtonElement;
    expect(gBtn).toBeTruthy();
    fireEvent.click(gBtn);
    expect(gBtn.getAttribute('aria-busy')).toBe('true'); // loading state
    await settle(1300);
    await waitFor(() => expect(loginBtn()).toBeFalsy()); // entered the app
    expect(localStorage.getItem('sensei_auth_session_v1')).toContain('google');
  });
});

describe('forgot → reset → done — password actually changes', () => {
  it('resets the seed account password through the full three-step flow', async () => {
    await openLogin();
    fireEvent.click(document.querySelectorAll('a')[0] as HTMLElement); // "שכחתם סיסמה?"
    await settle();
    // step 1: request (email prefilled from the login form)
    const forgotEmail = document.querySelector('input[autocomplete="email"]') as HTMLInputElement;
    fireEvent.input(forgotEmail, { target: { value: 'rotem@clinic.co.il' } });
    fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'שליחת קישור') as HTMLElement);
    await settle();
    // step 2: sent → continue (demo shortcut, no real email)
    const cont = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('המשך ליצירת סיסמה'));
    expect(cont, 'sent screen offers the demo continue').toBeTruthy();
    fireEvent.click(cont as HTMLElement);
    await settle();
    // step 3: new password + confirm
    fireEvent.input(document.querySelector('input[aria-label="סיסמה חדשה"]') as HTMLInputElement, { target: { value: 'brand-new-9' } });
    fireEvent.input(document.querySelector('input[aria-label="אימות סיסמה חדשה"]') as HTMLInputElement, { target: { value: 'brand-new-9' } });
    fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'שמירת הסיסמה החדשה') as HTMLElement);
    await settle();
    expect(document.body.textContent).toContain('הסיסמה אופסה בהצלחה');
    // the change is real: old password dead, new one works
    expect(authLogin('rotem@clinic.co.il', 'demo1234').ok).toBe(false);
    expect(authLogin('rotem@clinic.co.il', 'brand-new-9').ok).toBe(true);
  });
});

describe('remember-me enforcement — non-remembered sessions expire with the browser', () => {
  it('a stale non-remembered session lands on the expired screen instead of the app', async () => {
    const r = authLogin('rotem@clinic.co.il', 'demo1234');
    if (!('user' in r)) throw new Error('setup');
    createSession(r.user, false); // remember me OFF
    sessionStorage.clear();       // simulate a browser restart (tab marker gone)
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('פג תוקף ההתחברות'));
    expect(localStorage.getItem('sensei_auth_session_v1'), 'stale record is cleared').toBeNull();
  });

  it('a remembered session is restored into the app untouched', async () => {
    const r = authLogin('rotem@clinic.co.il', 'demo1234');
    if (!('user' in r)) throw new Error('setup');
    createSession(r.user, true); // remember me ON
    sessionStorage.clear();      // browser restart
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    await waitFor(() => expect(loginBtn()).toBeFalsy());
    expect(document.body.textContent).not.toContain('פג תוקף ההתחברות');
  });
});

describe('demo mode — preserved exactly', () => {
  it('the demo button still enters instantly with demoMode on and NO auth session record', async () => {
    await openLogin();
    fireEvent.click(document.querySelector('.auth-demo-btn') as HTMLElement);
    await settle();
    await waitFor(() => expect(loginBtn()).toBeFalsy());
    // demo creates no mock-auth session — its behavior is byte-identical to before
    expect(localStorage.getItem('sensei_auth_session_v1')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(PKEY) || '{}');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(PKEY) || '{}').demoMode ?? saved.demoMode).toBe(true));
  });
});
