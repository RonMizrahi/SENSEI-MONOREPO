// Settings · delete account — confirmation dialog and teardown to login.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { createSession, login as authLogin, register } from '../src/services/mockAuth';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = (ms = 80) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

describe('delete account — settings profile danger zone', () => {
  it('deletes a registered account and returns to the login screen', async () => {
    const r = register({ name: 'ד״ר נועה כהן', email: 'noa@clinic.co.il', password: 'sunlight-42' });
    if (!r.ok) throw new Error('setup');
    createSession(r.user, true);
    mount({ view: 'app', route: 'settings', settingsTab: 'profile' });
    await settle();

    const openBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'מחיקת חשבון');
    expect(openBtn).toBeTruthy();
    fireEvent.click(openBtn as HTMLElement);
    await settle();

    const confirmBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'מחיקת החשבון לצמיתות');
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn as HTMLElement);
    await settle();

    await waitFor(() => expect(document.querySelector('.auth-login-btn')).toBeTruthy());
    expect(localStorage.getItem(PKEY)).toBeNull();
    expect(authLogin('noa@clinic.co.il', 'sunlight-42')).toEqual({ ok: false, error: 'not-found' });
  });

  it('blocks deletion of the shipped demo account', async () => {
    const r = authLogin('rotem@clinic.co.il', 'demo1234');
    if (!('user' in r)) throw new Error('setup');
    createSession(r.user, true);
    mount({ view: 'app', route: 'settings', settingsTab: 'profile' });
    await settle();

    fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'מחיקת חשבון') as HTMLElement);
    await settle();
    fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'מחיקת החשבון לצמיתות') as HTMLElement);
    await settle(500);

    expect(document.querySelector('.auth-login-btn')).toBeFalsy();
    expect(document.body.textContent).toContain('מחיקת החשבון לצמיתות');
    expect(localStorage.getItem('sensei_auth_session_v1')).toBeTruthy();
    expect(authLogin('rotem@clinic.co.il', 'demo1234').ok).toBe(true);
  });
});
