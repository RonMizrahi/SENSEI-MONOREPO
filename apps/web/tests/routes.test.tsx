// Route smoke tests — every content route mounts inside the real store + shell
// without throwing, and the main landmark is present (GOVERNANCE §13 P0 nav).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { ALL_ROUTES, ROUTE_TITLES } from '../src/nav/navConfig';

const PKEY = 'sensei_session_react_v1';

function seedRoute(route: string) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route }));
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('route smoke renders', () => {
  for (const route of ALL_ROUTES) {
    it(`renders "${route}" (${ROUTE_TITLES[route]}) without crashing`, async () => {
      seedRoute(route);
      const { container } = render(
        <AppStoreProvider>
          <App />
        </AppStoreProvider>,
      );
      await waitFor(() => {
        expect(container.querySelector('#main-content')).toBeTruthy();
      });
      await waitFor(() => {
        expect(document.title).toContain('סנסיי');
      });
      // The page must actually render — not crash into the error boundary.
      // (The error boundary card renders inside #main-content, so a naive
      // "#main-content exists" check would pass even on a page crash.)
      expect(container.textContent).not.toContain('משהו השתבש במסך הזה');
    });
  }

  it('renders the auth view when signed out', async () => {
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'auth', authScreen: 'login' }));
    const { container } = render(
      <AppStoreProvider>
        <App />
      </AppStoreProvider>,
    );
    await waitFor(() => {
      expect(container.querySelector('#main-content')).toBeFalsy();
      expect(document.title).toBe('סנסיי · כניסה');
    });
  });
});
