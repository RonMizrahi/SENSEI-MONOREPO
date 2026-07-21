// The new-appointment default time always lands in working hours (09:00–20:00),
// so opening the app late at night or in the small hours never pre-fills an
// unrealistic session time.
import { describe, expect, it } from 'vitest';
import { defaultScheduleForm } from '../src/services/calendar';

const at = (h: number, m = 0) => { const d = new Date(2026, 6, 19, h, m, 0, 0); return d; };
const hour = (t: string) => Number(t.split(':')[0]);

describe('defaultScheduleForm — working-hours default', () => {
  it('daytime: next 30-min slot', () => {
    expect(defaultScheduleForm('p1', at(10, 5)).time).toBe('10:30');
    expect(defaultScheduleForm('p1', at(14, 40)).time).toBe('15:00');
  });

  it('small hours (before 08:00) → 09:00 same day', () => {
    for (const h of [0, 2, 5, 7]) {
      const f = defaultScheduleForm('p1', at(h, 15));
      expect(f.time).toBe('09:00');
    }
  });

  it('evening (>= 20:00) → 09:00 the next day', () => {
    const now = at(21, 10);
    const f = defaultScheduleForm('p1', now);
    expect(f.time).toBe('09:00');
    expect(f.date > (now.getFullYear() + '-07-19')).toBe(true); // rolled to next day
  });

  it('the default time is never outside 08:00–20:00', () => {
    for (let h = 0; h < 24; h++) {
      const h2 = hour(defaultScheduleForm('p1', at(h, 25)).time);
      expect(h2, `opened at ${h}:25`).toBeGreaterThanOrEqual(8);
      expect(h2).toBeLessThanOrEqual(20);
    }
  });
});
