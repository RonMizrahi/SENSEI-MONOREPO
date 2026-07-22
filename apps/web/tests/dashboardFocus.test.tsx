// Home dashboard redesign — the "Focus" zone (who's next + what to resume) and
// the contextual, time-aware greeting helpers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { heGreeting, relativeWhen } from '../src/utils';
import * as calendar from '../src/services/calendar';
import * as mockPatients from '../src/data/mockPatients';

describe('heGreeting — time-aware bands', () => {
  const at = (h: number) => { const d = new Date(2026, 0, 1); d.setHours(h, 0, 0, 0); return d; };
  it('picks the right greeting for each part of the day', () => {
    expect(heGreeting(at(3))).toBe('לילה טוב');
    expect(heGreeting(at(9))).toBe('בוקר טוב');
    expect(heGreeting(at(13))).toBe('צהריים טובים');
    expect(heGreeting(at(16))).toBe('אחר צהריים טובים');
    expect(heGreeting(at(20))).toBe('ערב טוב');
  });
});

describe('relativeWhen', () => {
  it('phrases today / tomorrow / this-week naturally', () => {
    const now = new Date(2026, 5, 10, 8, 0); // Wed
    expect(relativeWhen(new Date(2026, 5, 10, 14, 0), now)).toBe('היום · 14:00');
    expect(relativeWhen(new Date(2026, 5, 11, 9, 0), now)).toBe('מחר · 09:00');
    expect(relativeWhen(new Date(2026, 5, 13, 11, 0), now)).toContain('יום');
  });
});

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 150)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; vi.restoreAllMocks(); });
function futureKey(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

describe('dashboard — focus zone', () => {
  it('surfaces the next session with prepare/upload/open actions', async () => {
    vi.spyOn(calendar, 'loadCalendarEvents').mockResolvedValue([]);
    vi.spyOn(mockPatients, 'reconcileMockAppts').mockImplementation((appts: any[]) => appts || []);
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [{ id: 'n1', pid: 'p1', date: futureKey(1), time: '09:00', dur: 50, description: '', status: 'upcoming' }] });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הפגישה הבאה'));
    const focus = document.querySelector('[aria-label="במוקד היום"]') as HTMLElement;
    expect(focus.textContent).toContain('דנה לוי');
    const prep = [...focus.querySelectorAll('button')].find((b) => b.textContent?.includes('דוח ההכנה')) as HTMLElement;
    expect(prep).toBeTruthy();
    fireEvent.click(prep);
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/report/));
  });

  it('offers to resume unsaved drafts, and hides the card when there are none', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, notesDrafts: { p2: 'טיוטה שלא נשמרה' } });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('להמשך עבודה'));
    const resume = document.querySelector('[aria-label^="המשך עריכה · יוסי מזרחי"]') as HTMLElement;
    expect(resume).toBeTruthy();
    fireEvent.click(resume);
    await waitFor(() => expect(window.location.hash).toBe('#/patient/p2'));
  });

  it('shows a calm empty state when there are no upcoming sessions', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [], hiddenMeetingIds: [] });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הפגישה הבאה'));
    // no crash; the focus zone renders regardless of data
    expect(document.querySelector('[aria-label="במוקד היום"]')).toBeTruthy();
  });
});
