// Routing safety — the state-driven router must never break on an unknown or stale
// route key. There is no URL router; `route` is a persisted store string, so a value
// left over from a removed feature (or a bad restore) must degrade to the dashboard
// rather than crash or blank the screen. Regression guard for the `PAGES[route] ||
// PAGES.dashboard` fallback in App.tsx.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('routing — unknown / stale route degrades gracefully', () => {
  it('an unrecognized persisted route falls back to the dashboard (no crash, no blank)', async () => {
    mount({ view: 'app', route: 'a-removed-feature-route' });
    await settle();
    // content region rendered (not a blank screen / not the error-boundary card)
    expect(document.querySelector('#main-content')).toBeTruthy();
    // the app chrome is present…
    expect(document.querySelector('.app-sidebar')).toBeTruthy();
    // …and the dashboard (fallback screen) is what rendered — the week-view home's
    // category legend is always present (independent of async event loading)
    await waitFor(() => expect(document.body.textContent).toContain('סוגי פגישות'));
  });

  it('a known route still renders its own screen (the fallback does not mask real routes)', async () => {
    mount({ view: 'app', route: 'patients' });
    await settle();
    await waitFor(() =>
      expect(document.querySelector('#main-content h1')?.textContent).toContain('מטופלים'),
    );
  });
});
