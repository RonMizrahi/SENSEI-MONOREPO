// WCAG 1.4.3 color-contrast audit — deterministic, computed from the design
// tokens (the one rule the axe/jsdom suite can't evaluate without layout).
// Parses src/styles/tokens.css, merges the dark overrides onto the light base,
// and checks the meaningful text/surface pairs. Body/label text needs >= 4.5:1;
// large-text / UI-accent pairs need >= 3:1.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function block(re: RegExp): Record<string, string> {
  const m = css.match(re);
  const map: Record<string, string> = {};
  if (m) for (const t of m[1].matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) map[t[1]] = t[2];
  return map;
}
// Capture each rule's full body up to its closing brace (token blocks are flat,
// no nested braces). NB: `color-scheme:dark` sits at the START of the dark block,
// so matching up to it would capture nothing — match to `}` instead.
const light = block(/:root\{([\s\S]*?)\n\s*\}/);
const darkOverrides = block(/\[data-theme="dark"\]\{([\s\S]*?)\n\s*\}/);
const dark = { ...light, ...darkOverrides };

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a: string, b: string): number {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// [foreground token, background token, minRatio, description]
const PAIRS_NORMAL: [string, string, string][] = [
  ['--text', '--paper', 'body text on card'],
  ['--text', '--bg', 'body text on page'],
  ['--text-2', '--paper', 'strong text on card'],
  ['--text-secondary', '--paper', 'secondary text on card'],
  ['--text-secondary', '--surface-2', 'secondary text on surface-2'],
  ['--text-muted', '--paper', 'muted text on card'],
  ['--text-muted', '--surface-2', 'muted text on surface-2'],
  ['--ink-text', '--ink', 'sidebar label on ink'],
  ['--paper', '--primary', 'on-accent text (button)'],
  ['--error', '--error-bg', 'error badge label'],
  ['--success', '--success-bg', 'success badge label'],
  ['--warning-strong', '--warning-bg', 'warning badge label'],
  // Calendar week-view session categories — event label on its swatch (12px bold).
  ['--cat-weekly-text', '--cat-weekly-bg', 'weekly event label'],
  ['--cat-followup-text', '--cat-followup-bg', 'follow-up event label'],
  ['--cat-intake-text', '--cat-intake-bg', 'intake event label'],
  ['--cat-video-text', '--cat-video-bg', 'video event label'],
  ['--cat-couples-text', '--cat-couples-bg', 'couples event label'],
];

const PAIRS_LARGE: [string, string, string][] = [
  ['--primary', '--paper', 'link/accent on card (large/bold)'],
  ['--ink-muted', '--ink', 'muted sidebar text (large)'],
];

for (const [themeName, tk] of [['light', light], ['dark', dark]] as const) {
  describe(`color contrast (WCAG AA) — ${themeName} theme`, () => {
    it('normal text/label pairs meet 4.5:1', () => {
      const fails: string[] = [];
      for (const [fg, bg, desc] of PAIRS_NORMAL) {
        if (!tk[fg] || !tk[bg]) continue;
        const r = ratio(tk[fg], tk[bg]);
        if (r < 4.5) fails.push(`${desc} (${fg} ${tk[fg]} on ${bg} ${tk[bg]}) = ${r.toFixed(2)}:1`);
      }
      expect(fails, `Below 4.5:1:\n${fails.join('\n')}`).toEqual([]);
    });

    it('large-text / UI-accent pairs meet 3:1', () => {
      const fails: string[] = [];
      for (const [fg, bg, desc] of PAIRS_LARGE) {
        if (!tk[fg] || !tk[bg]) continue;
        const r = ratio(tk[fg], tk[bg]);
        if (r < 3) fails.push(`${desc} (${fg} ${tk[fg]} on ${bg} ${tk[bg]}) = ${r.toFixed(2)}:1`);
      }
      expect(fails, `Below 3:1:\n${fails.join('\n')}`).toEqual([]);
    });
  });
}
