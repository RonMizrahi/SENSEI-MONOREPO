import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([aria-disabled="true"])',
].join(',');

// Keyboard focus management for a modal/overlay:
//  • records the element focused before the overlay opened (the trigger),
//  • keeps Tab / Shift+Tab cycling *within* the overlay while it's open
//    (WCAG 2.4.3 + ARIA modal practice — focus must not escape to the
//    background content behind the modal),
//  • restores focus to the trigger when the overlay closes.
// It does NOT steal focus if the overlay already focused something inside
// (dialogs focus their first field, the palette focuses its input).
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    const container = ref.current;
    if (!container) return undefined;

    restoreTo.current = (document.activeElement as HTMLElement) || null;

    // The selector already excludes disabled / tabindex=-1; modal overlays don't
    // hold display:none focusables, so no visibility filter is needed (and
    // offsetParent-based filtering is unreliable — it's always null in jsdom).
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // If focus isn't already inside the overlay, move it to the first control.
    if (!container.contains(document.activeElement)) {
      const first = focusables()[0];
      if (first) first.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement;
      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) { e.preventDefault(); last.focus(); }
      } else {
        if (activeEl === last || !container.contains(activeEl)) { e.preventDefault(); first.focus(); }
      }
    };

    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      // Restore focus to the trigger, if it's still in the document.
      const el = restoreTo.current;
      if (el && document.contains(el) && typeof el.focus === 'function') el.focus();
    };
  }, [active]);

  return ref;
}
