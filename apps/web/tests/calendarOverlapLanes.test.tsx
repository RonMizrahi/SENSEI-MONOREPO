// Week-grid lane layout: two events that overlap in time must share the day
// column side-by-side (distinct inline offsets, fractional widths) instead of
// stacking on top of each other — the aria-label keeps each one identifiable.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
const pad = (n: number) => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 150)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

describe('dashboard week grid — overlapping events', () => {
  it('overlapping events get distinct lanes (no stacked duplicates at one offset)', async () => {
    mount({
      view: 'app', route: 'dashboard', onboardTipDismissed: true,
      scheduledAppts: [
        { id: 'ov1', pid: 'p1', date: todayKey(), time: '09:00', dur: '50', description: '' },
        { id: 'ov2', pid: 'p2', date: todayKey(), time: '09:30', dur: '50', description: '' },
      ],
    });
    await settle();
    await waitFor(() => expect(document.querySelectorAll('.calh-event').length).toBeGreaterThanOrEqual(2));
    const events = [...document.querySelectorAll<HTMLElement>('.calh-event')];
    // find the two seeded overlapping events by start time in the aria-label
    const at9 = events.filter((e) => /09:00|09:30/.test(e.getAttribute('aria-label') || ''));
    expect(at9.length).toBeGreaterThanOrEqual(2);
    const offsets = new Set(at9.map((e) => e.style.insetInlineStart));
    expect(offsets.size, 'overlapping events must not share one inline offset').toBeGreaterThan(1);
    for (const e of at9) expect(e.style.width, 'lane events use fractional widths').toContain('calc');
  });

  it('3+ overlapping events collapse to name-only slivers with a full tooltip', async () => {
    mount({
      view: 'app', route: 'dashboard', onboardTipDismissed: true,
      scheduledAppts: [
        { id: 'd1', pid: 'p1', date: todayKey(), time: '15:00', dur: '50', description: '' },
        { id: 'd2', pid: 'p2', date: todayKey(), time: '15:10', dur: '50', description: '' },
        { id: 'd3', pid: 'p3', date: todayKey(), time: '15:20', dur: '50', description: '' },
      ],
    });
    await settle();
    await waitFor(() => expect(document.querySelectorAll('.calh-event').length).toBeGreaterThanOrEqual(3));
    const dense = [...document.querySelectorAll<HTMLElement>('.calh-event')].filter((e) => /15:[012]0/.test(e.getAttribute('aria-label') || ''));
    expect(dense.length).toBe(3);
    for (const e of dense) {
      // name-only: a single text span, no second category/time line
      expect(e.querySelectorAll('span').length).toBe(1);
      // full details stay available via tooltip + aria-label
      expect(e.getAttribute('title')).toMatch(/15:[012]0/);
    }
  });

  it('a lone event still spans (nearly) the full column', async () => {
    mount({
      view: 'app', route: 'dashboard', onboardTipDismissed: true,
      scheduledAppts: [{ id: 'solo', pid: 'p1', date: todayKey(), time: '13:00', dur: '50', description: '' }],
    });
    await settle();
    await waitFor(() => expect(document.querySelectorAll('.calh-event').length).toBeGreaterThanOrEqual(1));
    const solo = [...document.querySelectorAll<HTMLElement>('.calh-event')].find((e) => /13:00/.test(e.getAttribute('aria-label') || ''))!;
    expect(solo.style.width).toContain('98%'); // 1 lane → (100-2)/1
  });
});
