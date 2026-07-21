// Hebrew count grammar: "1" takes a singular noun ("פגישה אחת"), never "1 פגישות".
import { describe, expect, it } from 'vitest';
import { heCount } from '../src/utils';

describe('heCount', () => {
  it('uses the singular phrase for exactly 1', () => {
    expect(heCount(1, 'פגישה אחת', 'פגישות')).toBe('פגישה אחת');
    expect(heCount(1, 'מטופל אחד בארכיון', 'מטופלים בארכיון')).toBe('מטופל אחד בארכיון');
  });
  it('uses "N <plural>" for 0 and 2+', () => {
    expect(heCount(0, 'פגישה אחת', 'פגישות')).toBe('0 פגישות');
    expect(heCount(3, 'פגישה אחת', 'פגישות')).toBe('3 פגישות');
  });
});
