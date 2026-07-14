// Theme application — the persisted theme preference is applied to the document root,
// and the app-bar theme control toggles it. `resolveTheme` is unit-tested elsewhere
// (pure); this covers the DOM side effect (data-theme on <html>) and the toggle wiring.
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
afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });

const themeToggle = () =>
  [...document.querySelectorAll('[role="button"]')].find((e) =>
    (e.getAttribute('aria-label') || '').startsWith('ערכת נושא')) as HTMLElement;
const dataTheme = () => document.documentElement.getAttribute('data-theme');

describe('theme — document application & toggle', () => {
  it('applies the persisted preference to <html data-theme> on load', async () => {
    mount({ view: 'app', route: 'dashboard', themePref: 'dark' });
    await settle();
    await waitFor(() => expect(dataTheme()).toBe('dark'));
  });

  it('toggling the app-bar theme control updates data-theme (light → dark)', async () => {
    mount({ view: 'app', route: 'dashboard', themePref: 'light' });
    await settle();
    await waitFor(() => expect(dataTheme()).toBe('light'));
    expect(themeToggle(), 'theme control is present in the app bar').toBeTruthy();
    fireEvent.click(themeToggle());
    // cycle order is light → dark
    await waitFor(() => expect(dataTheme()).toBe('dark'));
  });
});
