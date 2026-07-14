// Gendered Hebrew microcopy engine (`hg` / `hgTerm` → window.HG). This layer decides
// the grammatical gender of nearly every user-facing Hebrew string in the app; a
// regression here silently mis-genders copy on every screen (e.g. addressing a female
// patient in masculine forms). window.HG is loaded from `public/hebrew-grammar.js` by
// tests/setup.ts, so these exercise the REAL resolver — no mock — and also verify the
// util guards degrade gracefully when the grammar layer is absent.
import { afterEach, describe, expect, it } from 'vitest';
import { hg, hgTerm } from '../src/utils';

describe('hg — inline [[masc|fem|neutral]] template resolution', () => {
  it('resolves a token by Hebrew gender code (ז / נ)', () => {
    expect(hg('[[מטופל|מטופלת]]', 'ז')).toBe('מטופל');
    expect(hg('[[מטופל|מטופלת]]', 'נ')).toBe('מטופלת');
  });

  it('substitutes tokens inline and leaves the surrounding text untouched', () => {
    expect(hg('שלום [[מטופל|מטופלת]] יקר', 'נ')).toBe('שלום מטופלת יקר');
  });

  it('resolves every token in a multi-token template independently', () => {
    expect(hg('[[מטופל|מטופלת]] [[דיווח|דיווחה]] על שיפור', 'נ')).toBe('מטופלת דיווחה על שיפור');
  });

  it('unknown/empty gender → the unmarked masculine form (never a slash) for two-form tokens', () => {
    expect(hg('[[מטופל|מטופלת]]', '')).toBe('מטופל');
    expect(hg('[[מטופל|מטופלת]]', 'somethingelse')).toBe('מטופל');
  });

  it('unknown gender → the authored neutral 3rd form when present', () => {
    expect(hg('[[מטופל|מטופלת|מטופל/ת]]', 'unknown')).toBe('מטופל/ת');
  });

  it('accepts liberal gender inputs (m/f, male/female)', () => {
    expect(hg('[[מטופל|מטופלת]]', 'f')).toBe('מטופלת');
    expect(hg('[[מטופל|מטופלת]]', 'male')).toBe('מטופל');
  });

  it('passes plain text (no tokens) through unchanged', () => {
    expect(hg('טקסט רגיל ללא תבנית', 'נ')).toBe('טקסט רגיל ללא תבנית');
  });
});

describe('hgTerm — named gendered dictionary terms', () => {
  it('resolves role nouns by gender', () => {
    expect(hgTerm('patient', 'ז')).toBe('מטופל');
    expect(hgTerm('patient', 'נ')).toBe('מטופלת');
    expect(hgTerm('therapist', 'נ')).toBe('מטפלת');
  });

  it('prefixes the definite article ה־ with { def: true }', () => {
    expect(hgTerm('patient', 'נ', { def: true })).toBe('המטופלת');
  });

  it('falls back to the raw key for an unknown term (no crash)', () => {
    expect(hgTerm('nonexistent-role', 'נ')).toBe('nonexistent-role');
  });
});

describe('hg / hgTerm — resilient when the grammar layer failed to load', () => {
  // Both utils guard on window.HG; if the script never loaded they must return the
  // raw template/term rather than throw and take the screen down.
  const saved = (window as any).HG;
  afterEach(() => { (window as any).HG = saved; });

  it('returns the raw input when window.HG is undefined', () => {
    ;(window as any).HG = undefined;
    expect(hg('[[מטופל|מטופלת]]', 'נ')).toBe('[[מטופל|מטופלת]]');
    expect(hgTerm('patient', 'נ')).toBe('patient');
  });
});
