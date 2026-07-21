// Home "at-a-glance" workload strip — always shows today + this-week, surfaces
// drafts and follow-ups-to-schedule only when relevant, and the follow-up pill
// navigates to the patients list.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import * as calendar from '../src/services/calendar';
import * as mockPatients from '../src/data/mockPatients';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 150)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; vi.restoreAllMocks(); });
const pad = (n: number) => String(n).padStart(2, '0');
const key = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const strip = () => document.querySelector('[aria-label="סיכום היום"]') as HTMLElement;

describe('dashboard — workload summary strip', () => {
  it('always shows today and this-week tiles', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [] });
    await settle();
    await waitFor(() => expect(strip()).toBeTruthy());
    expect(strip().textContent).toMatch(/פגישה היום|פגישות היום/);
    expect(strip().textContent).toMatch(/פגישה השבוע|פגישות השבוע/);
  });

  it('counts today\'s scheduled sessions', async () => {
    // Isolate from weekly fixture + mock schedule backfill (both are date-dependent).
    vi.spyOn(calendar, 'loadCalendarEvents').mockResolvedValue([]);
    vi.spyOn(mockPatients, 'reconcileMockAppts').mockImplementation((appts: any[]) => appts || []);
    mount({
      view: 'app', route: 'dashboard', onboardTipDismissed: true,
      scheduledAppts: [
        { id: 'a', pid: 'p1', date: key(0), time: '14:00', dur: 50 },
        { id: 'b', pid: 'p2', date: key(0), time: '16:00', dur: 50 },
      ],
    });
    await settle();
    await waitFor(() => expect(strip()).toBeTruthy());
    const values = [...strip().querySelectorAll('.dash-summary-value')].map((n) => n.textContent);
    expect(values[0]).toBe('2'); // today tile
  });

  it('surfaces an actionable follow-ups tile that opens the patients list', async () => {
    // p1 has an upcoming appointment; p2–p5 only have a PAST one (so the mock
    // backfill leaves them alone) → they are "awaiting" a follow-up.
    mount({
      view: 'app', route: 'dashboard', onboardTipDismissed: true,
      scheduledAppts: [
        { id: 'a', pid: 'p1', date: key(2), time: '10:00', dur: 50 },
        { id: 'b', pid: 'p2', date: key(-5), time: '10:00', dur: 50 },
        { id: 'c', pid: 'p3', date: key(-5), time: '11:00', dur: 50 },
        { id: 'd', pid: 'p4', date: key(-5), time: '12:00', dur: 50 },
        { id: 'e', pid: 'p5', date: key(-5), time: '13:00', dur: 50 },
      ],
    });
    await settle();
    await waitFor(() => expect(strip()).toBeTruthy());
    const action = strip().querySelector('.dash-summary-pill--action') as HTMLElement;
    expect(action, 'a follow-ups-to-schedule tile is shown').toBeTruthy();
    expect(action.textContent).toContain('ללא פגישה');
    fireEvent.click(action);
    await waitFor(() => expect(window.location.hash).toBe('#/patients'));
  });
});

describe('dashboard — workload counts match the calendar (SSOT)', () => {
  it('uses the caller-provided today/week counts (complete weekEvents) over scheduledAppts-only stats', async () => {
    const { default: DashboardSummary } = await import('../src/components/DashboardSummary');
    // scheduledAppts is empty, but the page supplies the complete calendar counts —
    // the strip must show those, not 0, so it never disagrees with the calendar.
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), scheduledAppts: [] }));
    render(<AppStoreProvider><DashboardSummary todayCount={3} weekCount={15} /></AppStoreProvider>);
    await settle();
    const s = strip();
    expect(s.textContent).toContain('3');
    expect(s.textContent).toContain('15');
    expect(s.textContent).toContain('פגישות היום');
    expect(s.textContent).toContain('פגישות השבוע');
  });
});
