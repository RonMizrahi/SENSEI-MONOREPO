// Mobile experience — below 768px the app renders the dedicated mobile shell
// (MobileApp) with the touch-first day view instead of the desktop AppShell.
// matchMedia is mocked to activate the mobile branch (useIsMobile). The day view
// reads the same client-only fixture as the calendar; Monday of the current week
// always has fixture events, so selection + expand + sheets are deterministic.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { MOBILE_QUERY } from '../src/hooks/useIsMobile';

const PKEY = 'sensei_session_react_v1';

function setMobile(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q === MOBILE_QUERY,
    media: q,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as any;
}

function mount() {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard' }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}

beforeEach(() => setMobile(true));
afterEach(() => { vi.useRealTimers(); cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

/** Select Monday (strip index 1 — Sunday is 0) which always carries fixture events. */
async function selectMondayWithAppts(container: HTMLElement) {
  await waitFor(() => expect(container.querySelectorAll('.mob-day-btn').length).toBe(14));
  const monday = container.querySelectorAll('.mob-day-btn')[1] as HTMLElement;
  act(() => { fireEvent.click(monday); });
  await waitFor(() => expect(container.querySelectorAll('.mob-appt').length).toBeGreaterThan(0), { timeout: 3000 });
}

describe('mobile day view', () => {
  it('renders the mobile shell + day view (not the desktop AppShell)', async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector('.mob-shell')).toBeTruthy());
    expect(container.querySelector('.mob-daystrip')).toBeTruthy();
    // the desktop main region is not used on mobile shell (it has its own)
    expect(container.querySelector('.mob-content')).toBeTruthy();
  });

  it('the menu button opens the sidebar drawer', async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector('.mob-iconbtn')).toBeTruthy());
    expect(container.querySelector('.app-sidebar')?.classList.contains('open')).toBe(false);
    fireEvent.click(container.querySelector('.mob-iconbtn') as HTMLElement);
    await waitFor(() => expect(container.querySelector('.app-sidebar')?.classList.contains('open')).toBe(true));
  });

  it('expands an appointment to reveal quick actions', async () => {
    const { container } = mount();
    await selectMondayWithAppts(container);
    expect(container.querySelector('.mob-actions')).toBeFalsy();
    fireEvent.click(container.querySelector('.mob-plus') as HTMLElement);
    await waitFor(() => expect(container.querySelector('.mob-actions')).toBeTruthy());
    // three actions: insight, attach, direct recording (the in-browser capture path)
    expect(container.querySelectorAll('.mob-actions .mob-action-btn').length).toBe(3);
    const labels = [...container.querySelectorAll('.mob-actions .mob-action-btn')].map((b) => b.getAttribute('aria-label') || '');
    expect(labels.some((l) => /הקלטת פגישה/.test(l)), 'direct-record action present').toBe(true);
  });

  it('day-strip shows a meeting dot only on days with scheduled appointments', async () => {
    // Freeze only Date (timers stay real for waitFor) to a fixed reference day — the
    // day-strip is built relative to "today", so this assertion is otherwise date-fragile.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 21, 9, 0, 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    const k = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    localStorage.setItem(PKEY, JSON.stringify({
      __savedAt: Date.now(), view: 'app', route: 'dashboard',
      scheduledAppts: [{ id: 'd1', pid: 'p1', date: k(0), time: '23:00', dur: 50 }],
    }));
    const { container } = render(<AppStoreProvider><App /></AppStoreProvider>);
    await waitFor(() => expect(container.querySelectorAll('.mob-day-btn').length).toBeGreaterThan(0));
    const withDot = [...container.querySelectorAll('.mob-day-btn')].filter((b) => b.querySelector('.mob-day-dot.has'));
    expect(withDot.length, 'today (with an appt) carries a dot').toBeGreaterThanOrEqual(1);
    expect(withDot[0]?.textContent).toContain(String(new Date().getDate()));
    expect(withDot[0]?.textContent, 'screen-reader affordance').toContain('יש פגישות');
    // days without appointments have the placeholder dot but not the filled state
    const without = [...container.querySelectorAll('.mob-day-btn')].find((b) => !b.querySelector('.mob-day-dot.has'));
    expect(without?.querySelector('.mob-day-dot'), 'placeholder keeps alignment').toBeTruthy();
  });

  it('shows the workload line and a resume-draft chip that opens the patient file', async () => {
    localStorage.setItem(PKEY, JSON.stringify({
      __savedAt: Date.now(), view: 'app', route: 'dashboard',
      notesDrafts: { p2: 'טיוטה שהתחלתי בדרך' },
    }));
    const { container } = render(<AppStoreProvider><App /></AppStoreProvider>);
    await waitFor(() => expect(container.textContent).toContain('פגישות השבוע'));
    const chip = container.querySelector('[aria-label^="המשך עריכה · יוסי מזרחי"]') as HTMLElement;
    expect(chip, 'the unsaved draft is recoverable from the phone home').toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(window.location.hash).toBe('#/patient/p2'));
  });

  it('an empty day surfaces the next upcoming session with prep + open actions', async () => {
    // Saturday (strip index 6) never carries fixture events (offsets 0–4 only), so
    // it's a deterministic empty day. Seed a future appt per patient so the next
    // upcoming session is well-defined (p1 = דנה לוי, the earliest).
    const future = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    localStorage.setItem(PKEY, JSON.stringify({
      __savedAt: Date.now(), view: 'app', route: 'dashboard',
      scheduledAppts: ['p1', 'p2', 'p3', 'p4', 'p5'].map((pid, i) => ({ id: 'f' + i, pid, date: future(200 + i), time: '09:00', dur: 50 })),
    }));
    const { container } = render(<AppStoreProvider><App /></AppStoreProvider>);
    await waitFor(() => expect(container.querySelectorAll('.mob-day-btn').length).toBe(14));
    fireEvent.click(container.querySelectorAll('.mob-day-btn')[6] as HTMLElement); // Saturday — empty
    await waitFor(() => expect(container.querySelector('.mob-empty')).toBeTruthy());
    expect(container.textContent).toContain('הפגישה הבאה שלך');
    expect(container.textContent).toContain('דנה לוי'); // p1, earliest upcoming
    fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent === 'הכנה לפגישה') as HTMLElement);
    await waitFor(() => expect(window.location.hash).toBe('#/report/p1'));
  });

  it('opens the insight sheet and confirms a save via a toast', async () => {
    const { container } = mount();
    await selectMondayWithAppts(container);
    fireEvent.click(container.querySelector('.mob-plus') as HTMLElement);
    await waitFor(() => expect(container.querySelector('.mob-actions')).toBeTruthy());
    const insightBtn = [...container.querySelectorAll('.mob-action-btn')]
      .find((b) => /תובנה מהירה/.test(b.getAttribute('aria-label') || '')) as HTMLElement;
    fireEvent.click(insightBtn);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    const ta = document.querySelector('.mob-sheet-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'שיפור ניכר בשינה' } });
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'שמירת תובנה') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeFalsy());
    await waitFor(() => expect(document.body.textContent).toContain('התובנה נשמרה'));
  });
});
