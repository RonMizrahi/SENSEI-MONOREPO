import { describe, expect, it } from 'vitest';
import { avatarColors, getPatient, pushRecent, riskMeta, validateFile } from '../src/utils';
import { initialState } from '../src/data/seed';

describe('riskMeta', () => {
  it('maps the four documented risk levels (GOVERNANCE §12)', () => {
    expect(riskMeta('high').label).toBe('סיכון גבוה');
    expect(riskMeta('medium').label).toBe('סיכון בינוני');
    expect(riskMeta('low').label).toBe('סיכון נמוך');
    expect(riskMeta('none').label).toBe('יציב');
  });
  it('uses only token colors', () => {
    for (const r of ['high', 'medium', 'low', 'none']) {
      expect(riskMeta(r).color).toMatch(/^var\(--/);
      expect(riskMeta(r).bg).toMatch(/^var\(--/);
    }
  });
});

describe('avatarColors', () => {
  it('derives a distinct tint per hex color', () => {
    expect(avatarColors('#1F63D6')).toEqual({ bg: '#1F63D622', color: '#1F63D6' });
  });
  it('falls back to primary tokens for missing/var colors', () => {
    expect(avatarColors(undefined).bg).toBe('var(--primary-tint)');
    expect(avatarColors('var(--primary)').color).toBe('var(--primary)');
  });
  it('produces a valid token/hex tint for every seeded patient', () => {
    for (const p of initialState.patients) {
      const a = avatarColors(p.color);
      expect(a.bg).toBeTruthy();
      expect(a.color).toBeTruthy();
    }
  });
  it('lifts avatar initials to WCAG AA contrast in dark mode', () => {
    // In dark mode the same-hue tint + saturated text collapses (the darkest seed
    // hue, #0E3C88, was 1.46:1). The theme-aware path must restore >= 4.5:1.
    document.documentElement.dataset.theme = 'dark';
    try {
      const worst = '#0E3C88';
      const a = avatarColors(worst);
      expect(a.bg).toBe('#0E3C8833'); // deeper tint
      expect(a.color).not.toBe(worst); // initials lightened toward white
      const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const [tr, tg, tb] = rgb(worst), card = [18, 32, 56], al = 0.2; // '33' alpha over the dark card
      const bg = [tr * al + card[0] * (1 - al), tg * al + card[1] * (1 - al), tb * al + card[2] * (1 - al)];
      const L1 = lum(rgb(a.color)), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    } finally {
      delete document.documentElement.dataset.theme;
    }
  });
});

describe('validateFile', () => {
  it('accepts MP3 / WAV / M4A case-insensitively', () => {
    expect(validateFile('a.mp3')).toBe(true);
    expect(validateFile('b.WAV')).toBe(true);
    expect(validateFile('c.m4a')).toBe(true);
    expect(validateFile('d.webm')).toBe(true);
    expect(validateFile('e.ogg')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(validateFile('x.pdf')).toBe(false);
    expect(validateFile('x.mp4')).toBe(false);
    expect(validateFile('')).toBe(false);
  });
});

describe('getPatient', () => {
  it('finds a patient by id and falls back safely', () => {
    expect(getPatient(initialState.patients, 'p3').name).toBe('מיכל כהן');
    expect(getPatient(initialState.patients, 'missing').id).toBe('p1');
    expect(getPatient([], 'missing').name).toBe('—');
  });
});

describe('pushRecent — recently-viewed patient tracking', () => {
  it('prepends most-recent-first and de-duplicates (move-to-front)', () => {
    expect(pushRecent(['p2', 'p3'], 'p1')).toEqual(['p1', 'p2', 'p3']);
    expect(pushRecent(['p1', 'p2', 'p3'], 'p3')).toEqual(['p3', 'p1', 'p2']);
  });
  it('caps the list and never grows unbounded', () => {
    expect(pushRecent(['a', 'b', 'c', 'd', 'e', 'f'], 'g')).toEqual(['g', 'a', 'b', 'c', 'd', 'e']);
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });
  it('is deterministic and idempotent — re-viewing the head is a no-op', () => {
    const once = pushRecent(['p5', 'p6'], 'p5');
    expect(once).toEqual(['p5', 'p6']);
    expect(pushRecent(once, 'p5')).toEqual(once);
  });
  it('guards empty id and non-array input', () => {
    expect(pushRecent(['p1'], '')).toEqual(['p1']);
    expect(pushRecent(undefined, 'p1')).toEqual(['p1']);
  });
});
