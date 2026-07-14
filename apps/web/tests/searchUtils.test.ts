import { describe, expect, it } from 'vitest';
import { normHe, scoreP, hlParts } from '../src/utils/search';

describe('normHe', () => {
  it('strips niqqud and geresh/gershayim, trims', () => {
    expect(normHe('  שָׁלוֹם  ')).toBe('שלום');
    expect(normHe("ד״ר")).toBe('דר');
    expect(normHe(null)).toBe('');
  });
});

describe('scoreP (canonical relevance ranking)', () => {
  const p = { id: 'p1', name: 'דנה לוי', phone: '054-1234567', email: 'dana@mail.com' };
  it('ranks exact > prefix > includes on name', () => {
    expect(scoreP(p, 'דנה לוי')).toBe(7);
    expect(scoreP(p, 'דנה')).toBe(6);
    expect(scoreP(p, 'לוי')).toBe(5);
  });
  it('matches phone digits and email', () => {
    expect(scoreP(p, '1234')).toBe(2);
    expect(scoreP(p, 'dana@')).toBe(1.5);
  });
  it('returns 0 for empty query or no match', () => {
    expect(scoreP(p, '')).toBe(0);
    expect(scoreP(p, 'zzz')).toBe(0);
  });
});

describe('hlParts (query highlighting)', () => {
  it('splits around the match and flags the highlighted part', () => {
    const parts = hlParts('דנה לוי', 'לוי');
    expect(parts.map((x) => x.t)).toEqual(['דנה ', 'לוי']);
    expect(parts.find((x) => x.t === 'לוי')!.fw).toBe(700);
  });
  it('returns one plain part when there is no query/match', () => {
    expect(hlParts('דנה', '').length).toBe(1);
    expect(hlParts('דנה', 'x')[0].bg).toBe('transparent');
  });
});
