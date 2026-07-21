// Guards the homepage tablet/touch target floor: the today's-list quick actions
// (.calh-agenda-act) must reach 44px at the ≤1024px breakpoint (spec: minimum
// 44×44 px touch targets). The compact 30px inline height is intentional for the
// mouse-driven desktop shell; this locks the responsive bump so it can't regress.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, '..', 'src', 'pages', 'dashboard.css'), 'utf8').replace(/\s+/g, ' ');

describe('dashboard touch targets', () => {
  it('raises .calh-agenda-act to a 44px min-height at the tablet breakpoint', () => {
    // The tablet media query and the 44px rule both exist…
    expect(CSS).toMatch(/@media \(max-width: 1024px\)/);
    expect(CSS).toMatch(/\.calh-agenda-act\s*\{\s*min-height:\s*44px/);
    // …and the rule sits AFTER the media opener (i.e. inside the tablet scope),
    // not as a desktop-wide rule.
    const mediaAt = CSS.indexOf('@media (max-width: 1024px)');
    const ruleAt = CSS.indexOf('.calh-agenda-act');
    expect(ruleAt).toBeGreaterThan(mediaAt);
  });
});
