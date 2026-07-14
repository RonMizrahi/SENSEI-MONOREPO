// Dashboard home — Google-Calendar-style week view. Verifies it renders the
// week's events from the client-only fixture (same source as CalendarPage),
// and that the week navigation + "today" reset drive the range heading.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount() {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard' }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
afterEach(() => { cleanup(); localStorage.clear(); });

const heading = (c: HTMLElement) => c.querySelector('h1')?.textContent?.trim() || '';

describe('dashboard — calendar week-view home', () => {
  it('renders the week\'s events from the fixture as clickable blocks', async () => {
    const { container } = mount();
    // the home is lazy-loaded (Suspense) — wait for its toolbar + legend to mount
    await waitFor(() => expect(container.querySelector('.calh-today-btn')).toBeTruthy());
    expect(container.textContent).toContain('סוגי פגישות');
    // events arrive from loadCalendarEvents (fixture) after its simulated latency
    await waitFor(() => {
      expect(container.querySelectorAll('.calh-event').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    // every event block is a keyboard-operable native button
    const ev = container.querySelector('.calh-event') as HTMLElement;
    expect(ev.tagName).toBe('BUTTON');
  });

  it('week navigation and "today" drive the range heading', async () => {
    const { container } = mount();
    await waitFor(() => expect(heading(container)).toBeTruthy());
    const start = heading(container);

    const next = container.querySelector('.calh-icon-btn[aria-label="השבוע הבא"]') as HTMLElement;
    act(() => { fireEvent.click(next); });
    await waitFor(() => expect(heading(container)).not.toBe(start));
    const advanced = heading(container);
    expect(advanced).not.toBe(start);

    const today = container.querySelector('.calh-today-btn') as HTMLElement;
    act(() => { fireEvent.click(today); });
    await waitFor(() => expect(heading(container)).toBe(start));
  });
});
