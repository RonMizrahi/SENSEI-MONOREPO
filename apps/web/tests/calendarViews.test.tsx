// The home calendar's day/week/month toggle must actually switch views, and
// clicking an empty slot must open the schedule dialog (prefilled).
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });
const btn = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLElement;

describe('home calendar — view toggle + click-to-create', () => {
  it('switches between week (7 columns), day (1 column), and month (grid)', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    await waitFor(() => expect(document.querySelectorAll('.calh-col-add').length).toBe(7));
    fireEvent.click(btn('יום'));
    await waitFor(() => expect(document.querySelectorAll('.calh-col-add').length).toBe(1));
    fireEvent.click(btn('חודש'));
    await waitFor(() => expect(document.querySelectorAll('.calh-month-cell').length).toBeGreaterThan(0));
    expect(document.querySelectorAll('.calh-col-add').length).toBe(0); // no time grid in month view
  });

  it('clicking an empty slot opens the schedule dialog', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    const slot = await waitFor(() => {
      const el = document.querySelector('.calh-col-add') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    fireEvent.click(slot);
    await waitFor(() => expect(document.body.textContent).toContain('קביעת פגישה חדשה'));
  });
});
