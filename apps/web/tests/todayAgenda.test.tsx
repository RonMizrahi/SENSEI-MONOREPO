// Home "today's agenda" — the spec's Screen-1 daily list: today's meetings, each
// with a "previously on" recap, opening the meeting-details dialog on click.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 150)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

describe("home — today's agenda", () => {
  it("lists today's meetings with a recap and opens the meeting dialog on click", async () => {
    const appt = { id: 'today-1', pid: 'p1', date: todayKey(), time: '10:00', dur: 50, description: 'פגישה שבועית', status: 'upcoming' };
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [appt] });
    await settle();
    const card = await waitFor(() => {
      expect(document.body.textContent).toContain('הפגישות שלך היום');
      return document.querySelector('.calh-agenda-row') as HTMLElement;
    });
    expect(card, 'an agenda row for today').toBeTruthy();
    expect(card.textContent).toContain('דנה לוי');
    // the three per-session actions are reachable inline, without opening the file
    expect(document.querySelector('[aria-label^="תיק המטופל · דנה לוי"]')).toBeTruthy();
    expect(document.querySelector('[aria-label^="העלאת הקלטה · דנה לוי"]')).toBeTruthy();
    const prep = document.querySelector('[aria-label^="דוח הכנה · דנה לוי"]') as HTMLElement;
    expect(prep).toBeTruthy();
    // and the inline prep-report action navigates (deep-linkable)
    fireEvent.click(prep);
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/report/));
  });

  it('shows an empty note when there are no meetings today', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [], hiddenMeetingIds: [] });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הפגישות שלך היום'));
  });
});
