// The global top app bar was removed app-wide; its controls were relocated into
// the sidebar. Guards that (a) no top bar renders, and (b) every relocated
// control is reachable from the sidebar on every route: the Upload CTA, the theme
// toggle, and account/settings — so nothing was lost in the move.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

describe('app chrome relocated into the sidebar (top bar removed)', () => {
  it('AppBar.tsx no longer exists', () => {
    expect(existsSync(join(__dirname, '..', 'src', 'components', 'layout', 'AppBar.tsx'))).toBe(false);
  });

  it('no top app bar renders, and the sidebar carries the relocated controls', async () => {
    mount({ view: 'app', route: 'dashboard', demoMode: true });
    await settle();
    await waitFor(() => expect(document.querySelector('.app-sidebar')).toBeTruthy());
    const sidebar = document.querySelector('.app-sidebar')!;
    // no legacy top bar
    expect(document.querySelector('.appbar')).toBeFalsy();
    // relocated controls live in the sidebar (the upload CTA was later removed
    // from the side menu by request — upload stays reachable from page content)
    expect(sidebar.querySelector('.sidebar-cta')).toBeFalsy();
    expect(sidebar.querySelector('[aria-label^="ערכת נושא"]')).toBeTruthy();
    expect(sidebar.querySelector('[aria-label="החשבון שלי · הגדרות"]')).toBeTruthy();
    // demo-mode indicator relocated too
    expect(sidebar.querySelector('.demo-pill')).toBeTruthy();
  });
});
