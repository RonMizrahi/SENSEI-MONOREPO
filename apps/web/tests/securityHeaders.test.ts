// Security-header regression guard (production gate). The headers are a
// hosting-layer contract shipped from two files (Netlify public/_headers,
// Vercel vercel.json); this test keeps them correct AND in agreement.
//
// The load-bearing case: Permissions-Policy must allow microphone for OUR OWN
// origin — the in-browser recording flow (useAudioRecorder → getUserMedia) is a
// core feature, and `microphone=()` (deny-all) silently breaks it in production
// while everything works in local dev (no headers). Everything else stays denied.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const netlify = readFileSync(resolve(root, 'public/_headers'), 'utf8');
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

const vercelHeader = (name: string): string => {
  for (const rule of vercel.headers || []) {
    for (const h of rule.headers || []) {
      if (h.key.toLowerCase() === name.toLowerCase()) return h.value;
    }
  }
  return '';
};
const netlifyHeader = (name: string): string => {
  const m = netlify.match(new RegExp('^\\s*' + name + ':\\s*(.+)$', 'mi'));
  return m ? m[1].trim() : '';
};

describe('security headers — production gate', () => {
  it('Permissions-Policy denies all powerful features (no in-browser recording — mic not needed)', () => {
    for (const pp of [netlifyHeader('Permissions-Policy'), vercelHeader('Permissions-Policy')]) {
      expect(pp, 'header present').toBeTruthy();
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('camera=()');
      expect(pp).toContain('geolocation=()');
      expect(pp).toContain('payment=()');
    }
  });

  it('Netlify and Vercel ship the SAME Permissions-Policy (no config drift)', () => {
    expect(netlifyHeader('Permissions-Policy')).toBe(vercelHeader('Permissions-Policy'));
  });

  it('CSP is strict: self-only scripts, no eval, no framing, no plugins', () => {
    for (const csp of [netlifyHeader('Content-Security-Policy'), vercelHeader('Content-Security-Policy')]) {
      expect(csp, 'CSP present').toBeTruthy();
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain('unsafe-eval');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    }
  });

  it('transport + sniffing protections are present on both hosts', () => {
    for (const get of [netlifyHeader, vercelHeader]) {
      expect(get('Strict-Transport-Security')).toContain('max-age=');
      expect(get('X-Content-Type-Options')).toBe('nosniff');
    }
  });
});
