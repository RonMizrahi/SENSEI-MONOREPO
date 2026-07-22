// Guard: every `var(--token)` referenced in JSX/TS (including fallback tokens
// inside `var(--a, var(--b))`) must be an actually-defined CSS custom property.
// The hex ratchet catches hardcoded colours; this catches the opposite mistake —
// referencing a token that doesn't exist (e.g. --warn-bg / --text-1), which
// silently renders with an invalid/inherited value.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

// Tokens defined anywhere in the stylesheets (any `--name:` declaration).
const cssText = ['styles/tokens.css', 'styles/global.css']
  .map((f) => readFileSync(join(SRC, f), 'utf8')).join('\n');
const defined = new Set([...cssText.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));

describe('design tokens — no reference to an undefined CSS variable', () => {
  it('every var(--token) in src resolves to a defined token', () => {
    const missing = new Map<string, string>();
    for (const f of walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const src = readFileSync(f, 'utf8');
      for (const raw of src.split('\n')) {
        const line = raw.replace(/\/\/.*$/, ''); // drop line comments (avoid illustrative var(--token) in prose)
        for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
          if (!defined.has(m[1]) && !missing.has(m[1])) missing.set(m[1], f.replace(SRC, 'src'));
        }
      }
    }
    expect([...missing.entries()].map(([t, f]) => `${t} (${f})`), 'undefined token references').toEqual([]);
  });
});
