// Frontend security regression suite.
//
// These are static-analysis-as-tests: they scan the whole `src/` tree and the
// persistence contract so a future change that reintroduces a real client-side
// risk fails CI. They validate the actual security boundaries of this
// client-only app (no backend, no tokens): unsafe rendering sinks, credential
// persistence, and hardcoded secrets. They assert nothing about UX.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// vitest runs with cwd at the project root.
const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const sourceFiles = walk(SRC);
const rel = (p: string) => p.slice(ROOT.length + 1);

describe('XSS / unsafe rendering — no dangerous DOM sinks in source', () => {
  // Attack scenario: a contributor renders user/AI-supplied content through an
  // HTML sink, turning stored/DOM data into script execution. React escapes by
  // default; these sinks opt out of that protection.
  const SINKS = [
    /dangerouslySetInnerHTML/,
    /\.innerHTML\s*=/,
    /\.outerHTML\s*=/,
    /insertAdjacentHTML/,
    /document\.write\s*\(/,
    /\beval\s*\(/,
    /new\s+Function\s*\(/,
  ];

  it('contains no unsafe HTML-injection or code-eval sinks', () => {
    const hits: string[] = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, 'utf8');
      for (const re of SINKS) {
        if (re.test(text)) hits.push(`${rel(f)} :: ${re}`);
      }
    }
    expect(hits, `Unsafe rendering sink(s) found:\n${hits.join('\n')}`).toEqual([]);
  });

  it('uses no javascript:/data:text/html URI schemes', () => {
    const hits: string[] = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, 'utf8');
      if (/javascript:|data:text\/html|srcdoc\s*=/.test(text)) hits.push(rel(f));
    }
    expect(hits, `Dangerous URI scheme(s) in:\n${hits.join('\n')}`).toEqual([]);
  });
});

describe('Outbound navigation & network — no tabnabbing or credentialed URLs', () => {
  // Attack scenario: window.open without noopener lets the opened page control the
  // opener via window.opener (reverse tabnabbing); a secret in a request URL leaks
  // via history/referrer/logs. Locks the Calendar link + fetch surfaces.
  it('every window.open uses noopener', () => {
    const hits: string[] = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/window\.open\([^)]*\)/g)) {
        if (!/noopener/.test(m[0])) hits.push(`${rel(f)} :: ${m[0]}`);
      }
    }
    expect(hits, `window.open without noopener:\n${hits.join('\n')}`).toEqual([]);
  });

  it('no fetch/request URL embeds a token/secret/credential literal', () => {
    const hits: string[] = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/fetch\(\s*([^)]*)\)/g)) {
        if (/token|apikey|api_key|secret|password|access_token/i.test(m[1])) hits.push(`${rel(f)} :: ${m[0].slice(0, 80)}`);
      }
    }
    expect(hits, `Credential-bearing request URL:\n${hits.join('\n')}`).toEqual([]);
  });
});

describe('Client storage — credentials are never persisted', () => {
  // Attack scenario: a password or token added to the persisted key set would be
  // written to localStorage in cleartext and be readable by any XSS or by anyone
  // on a shared device. Guard the persistence contract itself.
  const storeSrc = readFileSync(join(SRC, 'store/AppStore.tsx'), 'utf8');
  const match = storeSrc.match(/const PERSIST_KEYS\s*=\s*\[([\s\S]*?)\]/);
  const persistKeys = (match ? match[1] : '')
    .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);

  it('parses the PERSIST_KEYS contract from the store', () => {
    expect(persistKeys.length).toBeGreaterThan(10);
  });

  it('does not persist passwords, tokens, or secrets', () => {
    const FORBIDDEN = /(pass(word)?|token|secret|bearer|creden|jwt|apikey|api_key|otp|pin)/i;
    const leaked = persistKeys.filter((k) => FORBIDDEN.test(k));
    expect(leaked, `Sensitive key(s) in persistence set: ${leaked.join(', ')}`).toEqual([]);
  });
});

describe('Secret exposure — no hardcoded credentials or env secrets in source', () => {
  // Attack scenario: an API key / private key committed to the frontend ships in
  // the public bundle. This app makes no network calls and holds no real secrets;
  // this guards against one being introduced.
  const SECRET_PATTERNS: [RegExp, string][] = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
    [/\bsk_(live|test)_[0-9a-zA-Z]{16,}\b/, 'Stripe secret key'],
    [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
    [/\bgh[pousr]_[0-9A-Za-z]{36,}\b/, 'GitHub token'],
    [/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, 'Slack token'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, 'JWT'],
  ];

  it('contains no recognizable secret material', () => {
    const hits: string[] = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, 'utf8');
      for (const [re, label] of SECRET_PATTERNS) {
        if (re.test(text)) hits.push(`${rel(f)} :: ${label}`);
      }
    }
    expect(hits, `Possible secret(s):\n${hits.join('\n')}`).toEqual([]);
  });

  it('reads no build-time env secrets (import.meta.env.* / process.env.* beyond NODE_ENV)', () => {
    // Allowed exceptions: `VITE_API_BASE_URL` — a client-safe public backend base
    // URL (not a secret), consumed by the canonical API client — plus Vite's
    // non-secret build-time built-ins (`DEV`/`PROD`/`MODE`/`SSR`/`BASE_URL`),
    // which are compile-time flags, never secrets (used to hide dev-only demo
    // affordances in production builds). Any OTHER env read is flagged;
    // VITE_-prefixed vars are inlined into the bundle and must never hold secrets.
    const hits: string[] = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, 'utf8');
      const envRefs = [
        ...text.matchAll(/import\.meta\.env\.(?!(VITE_API_BASE_URL|DEV|PROD|MODE|SSR|BASE_URL)\b)[A-Za-z_]+/g),
        ...text.matchAll(/process\.env\.(?!NODE_ENV\b)[A-Za-z_]+/g),
      ].map((m) => m[0]);
      if (envRefs.length) hits.push(`${rel(f)} :: ${envRefs.join(', ')}`);
    }
    expect(hits, `Env-var reads (review for secret exposure):\n${hits.join('\n')}`).toEqual([]);
  });
});
