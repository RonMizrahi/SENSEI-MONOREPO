// Backend readiness — a failed calendar load must surface an error + retry, not
// a silent empty week ("no meetings" and "the request failed" are different
// truths). The fixture never fails in demo mode, so this simulates the API-
// backed mode by rejecting loadCalendarEvents; retry must recover.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import * as calendar from '../src/services/calendar';

const PKEY = 'sensei_session_react_v1';
const settle = (ms = 150) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('week events — API failure state', () => {
  it('shows an error strip with retry on the home calendar; retry recovers', async () => {
    const spy = vi.spyOn(calendar, 'loadCalendarEvents')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue([]);
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard', onboardTipDismissed: true }));
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();

    // failure is visible, with the honest caveat that local appointments remain
    await waitFor(() => expect(document.body.textContent).toContain('טעינת היומן נכשלה'), { timeout: 3000 });
    const retry = [...document.querySelectorAll('button')].find((b) => b.textContent === 'ניסיון חוזר') as HTMLElement;
    expect(retry, 'a retry affordance is offered').toBeTruthy();

    fireEvent.click(retry);
    await waitFor(() => expect(document.body.textContent).not.toContain('טעינת היומן נכשלה'), { timeout: 3000 });
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
