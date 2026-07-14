// Share utilities — WhatsApp/mailto URL generation, UTF-8 encoding, sanitization, and
// RTL/mixed-language handling. Pure functions; no DOM/network.
import { describe, expect, it } from 'vitest';
import { sanitizeShareText, canShare, buildWhatsAppUrl, buildMailtoUrl } from '../src/utils/share';

const NUL = String.fromCharCode(0);
const BELL = String.fromCharCode(7);
const DEL = String.fromCharCode(127);

describe('share — sanitizeShareText', () => {
  it('preserves Hebrew, English, mixed content, numbers and line breaks', () => {
    const t = 'שלום Dr. Cohen\nמספר רישיון 27-104882 · 5 פגישות';
    expect(sanitizeShareText(t)).toBe(t);
  });
  it('normalizes CRLF and collapses 3+ blank lines to one', () => {
    expect(sanitizeShareText('a\r\nb\n\n\n\nc')).toBe('a\nb\n\nc');
  });
  it('strips control chars but keeps tab and newline', () => {
    expect(sanitizeShareText('a' + NUL + 'b' + BELL + 'c' + DEL + '\td\ne')).toBe('abc\td\ne');
  });
  it('trims, and handles empty / null / undefined', () => {
    expect(sanitizeShareText('  \n  ')).toBe('');
    expect(sanitizeShareText(undefined as any)).toBe('');
    expect(sanitizeShareText(null as any)).toBe('');
  });
});

describe('share — canShare (empty-content guard)', () => {
  it('is false for empty/whitespace, true for real content', () => {
    expect(canShare('')).toBe(false);
    expect(canShare('   \n\t ')).toBe(false);
    expect(canShare('שלום')).toBe(true);
  });
});

describe('share — buildWhatsAppUrl', () => {
  it('uses wa.me and percent-encodes text (spaces + newlines, not raw)', () => {
    const url = buildWhatsAppUrl('שלום world\nline2');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).toContain('%20'); // space encoded
    expect(url).toContain('%0A'); // newline encoded
    expect(decodeURIComponent(url.split('text=')[1])).toBe('שלום world\nline2');
  });
  it('round-trips a URL and numbers embedded in RTL text', () => {
    const t = 'ראו כאן https://sensei.example.com/x?a=1&b=2 · מספר 12345';
    expect(decodeURIComponent(buildWhatsAppUrl(t).split('text=')[1])).toBe(t);
  });
});

describe('share — buildMailtoUrl', () => {
  it('encodes subject + body and omits the recipient by default (no PII auto-fill)', () => {
    const url = buildMailtoUrl({ subject: 'מכתב קליני · דנה לוי', body: 'שורה 1\nשורה 2' });
    expect(url.startsWith('mailto:?')).toBe(true); // empty recipient
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('subject')).toBe('מכתב קליני · דנה לוי');
    expect(params.get('body')).toBe('שורה 1\nשורה 2'); // line break preserved
  });
  it('includes an explicit recipient only when provided (encoded)', () => {
    expect(buildMailtoUrl({ subject: 's', body: 'b', to: 'x@y.co' }).startsWith('mailto:x%40y.co?')).toBe(true);
  });
  it('never leaks control chars into the payload', () => {
    const params = new URLSearchParams(buildMailtoUrl({ subject: 'a' + NUL + 'b', body: 'c' + BELL + 'd' }).split('?')[1]);
    expect(params.get('subject')).toBe('ab');
    expect(params.get('body')).toBe('cd');
  });
});
