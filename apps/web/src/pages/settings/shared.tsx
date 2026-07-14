// Settings screen — shared helpers ported from the prototype logic class.
import React from 'react';

// Enter/Space activation for non-native interactive elements (WCAG 2.1.1).
export const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};

// Derive up-to-two-letter initials from a name, stripping common honorifics
// (port of the prototype's _initials).
export function initials(name: any): string {
  const src = String(name || '').replace(/["'׳״]/g, '').trim();
  if (!src) return '·';
  const stop: Record<string, number> = { 'דר': 1, 'ד': 1, 'פרופ': 1, 'מר': 1, 'גב': 1, dr: 1, prof: 1 };
  const words = src.split(/\s+/).filter((w) => !stop[w.toLowerCase()]);
  const use = (words.length ? words : src.split(/\s+/)).slice(0, 2);
  const letters = use.map((w) => w[0]).join('');
  return letters.length > 1 ? letters[0] + '״' + letters[1] : letters;
}

// The prototype's toggle-switch markup, repeated verbatim across tabs.
export function Toggle({ checked, onToggle, ariaLabel }: { checked: boolean; onToggle: () => void; ariaLabel?: string }) {
  return (
    <div
      onClick={onToggle}
      onKeyDown={keyAct(onToggle)}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      tabIndex={0}
      style={{ width: 44, height: 25, borderRadius: 14, background: checked ? 'var(--primary)' : 'var(--toggle-off)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}
    >
      <div style={{ width: 19, height: 19, borderRadius: '50%', background: 'var(--paper)', position: 'absolute', top: 3, [checked ? 'left' : 'right']: 3, boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'all .2s' } as any} />
    </div>
  );
}
