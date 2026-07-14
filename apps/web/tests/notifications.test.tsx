// Notification center — unread count, mark-all-read, and filtering.
// Seeded state (see src/data/seed.ts): notifRead ['n8','n10','n11'],
// notifArchived ['n11'], notifFilter 'all'. Active (non-archived) notifications
// are the 8 in NOTIFS minus n11; of those, n8 and n10 are read, so 6 are unread.
// We drive the real UI (header actions + filter chips) and assert user-visible
// Hebrew text/state, polling with waitFor after every action for determinism.
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
afterEach(() => { cleanup(); localStorage.clear(); });

const main = () => document.querySelector('#main-content') as HTMLElement;
const byText = (t: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t)) as HTMLElement;
// filter chips are role="button" anchors, not <button>
const chip = (label: string) => [...main().querySelectorAll('[role="button"]')].find((a) => a.textContent?.trim().startsWith(label)) as HTMLElement;

async function openNotifCenter() {
  mount({ view: 'app', route: 'notifications' });
  await settle();
  // page is lazy-loaded — wait for its heading before asserting
  await waitFor(() => expect([...document.querySelectorAll('h1')].some((h) => h.textContent?.includes('מרכז ההתראות'))).toBe(true));
}

describe('notification center — unread count, mark-all-read, filtering', () => {
  it('shows the seeded unread/total summary (6 unread of 8 active)', async () => {
    await openNotifCenter();
    await waitFor(() => expect(main().textContent).toContain('6 התראות שלא נקראו מתוך 8 פעילות'));
  });

  it('"סמנו הכל כנקרא" clears the unread count to zero', async () => {
    await openNotifCenter();
    await waitFor(() => expect(main().textContent).toContain('6 התראות שלא נקראו'));
    fireEvent.click(byText('סמנו הכל כנקרא'));
    // after marking all read, the summary reports 0 unread of the same 8 active
    await waitFor(() => expect(main().textContent).toContain('0 התראות שלא נקראו מתוך 8 פעילות'));
  });

  it('the "לא נקראו" filter lists only unread items, and its count matches', async () => {
    await openNotifCenter();
    // an already-read system notification is visible under the default "all" filter
    await waitFor(() => expect(main().textContent).toContain('עדכון מערכת'));

    fireEvent.click(chip('לא נקראו'));
    // read notifications drop out of the list, unread ones remain
    await waitFor(() => expect(main().textContent).not.toContain('עדכון מערכת'));
    expect(main().textContent).toContain('דגל סיכון חדש'); // n2, unread

    // marking all read then leaves the unread filter empty → empty state copy
    fireEvent.click(byText('סמנו הכל כנקרא'));
    await waitFor(() => expect(main().textContent).toContain('הכול נקרא'));
  });

  it('the "ארכיון" filter surfaces the archived notification hidden from the active list', async () => {
    await openNotifCenter();
    // n11 ("פגישה בוטלה") is archived — not shown under the default active view
    await waitFor(() => expect(main().textContent).toContain('עדכון מערכת'));
    expect(main().textContent).not.toContain('פגישה בוטלה');

    fireEvent.click(chip('ארכיון'));
    await waitFor(() => expect(main().textContent).toContain('פגישה בוטלה'));
    // and the non-archived active items are no longer listed
    expect(main().textContent).not.toContain('עדכון מערכת');
  });
});
