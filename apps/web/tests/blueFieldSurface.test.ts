// Guards the unified blue field surface (DESIGN_SYSTEM §5 "Fields (SSOT)").
// Every editable/selectable control shares one blue design: --primary-surface
// fill + --primary-border edge. Two invariants are locked here so the system
// can't silently drift back to gray:
//   1. global.css ships the zero-specificity :where() "blue floor" so any NEW
//      text-like field inherits --primary-surface without per-field styling.
//   2. No field element (<input>/<textarea>/<select>) sets a gray background
//      (--paper / --surface / --surface-2 / --bg / --divider) inline.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const GLOBAL_CSS = readFileSync(join(SRC, 'styles', 'global.css'), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('unified blue field surface', () => {
  it('global.css ships the zero-specificity :where() blue floor on --primary-surface', () => {
    const floor = GLOBAL_CSS.replace(/\s+/g, ' ');
    expect(floor).toMatch(/:where\([\s\S]*?\binput\b[\s\S]*?\btextarea\b,\s*select\s*\)\s*\{\s*background-color:\s*var\(--primary-surface\)/);
  });

  it('the floor covers the disabled state with a muted, non-blue fill', () => {
    const css = GLOBAL_CSS.replace(/\s+/g, ' ');
    expect(css).toMatch(/:where\([\s\S]*?\btextarea\b,\s*select\s*\):disabled\s*\{[^}]*background-color:\s*var\(--surface-2\)/);
    expect(css).toMatch(/:where\([\s\S]*?\):disabled\s*\{[^}]*cursor:\s*not-allowed/);
  });

  it('no field element sets a gray background inline', () => {
    const GRAY = ['--paper', '--surface-2', '--surface-3', '--bg', '--divider'];
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      // Field elements whose opening tag carries an inline `background: var(--gray)`.
      const re = /<(input|textarea|select)\b[^>]*?background:\s*'var\((--[a-z0-9-]+)\)'/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (GRAY.includes(m[2])) offenders.push(`${file.replace(SRC, 'src')}: <${m[1]}> background var(${m[2]})`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
