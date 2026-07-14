// Calendar network discipline — in the client-only build (no VITE_API_BASE_URL)
// the calendar must render its integration fixture WITHOUT firing any request.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

describe('calendar — client-only build never fires network requests', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    cleanup();
    localStorage.clear();
  });

  it('renders calendar events from the fixture with zero network requests', async () => {
    vi.resetModules();
    const [{ default: App }, { AppStoreProvider }] = await Promise.all([
      import('../src/App'),
      import('../src/store/AppStore'),
    ]);
    localStorage.setItem('sensei_session_react_v1', JSON.stringify({ view: 'app', route: 'calendar' }));
    const { container } = render(
      <AppStoreProvider>
        <App />
      </AppStoreProvider>,
    );
    await waitFor(() => expect(container.querySelector('h1')?.textContent).toContain('יומן'));
    await waitFor(() => expect(container.textContent).toMatch(/פגישה שבועית|פגישת מעקב/), { timeout: 4000 });
    expect(fetchSpy, 'the client-only calendar makes no network calls at all').not.toHaveBeenCalled();
  }, 15000);
});
