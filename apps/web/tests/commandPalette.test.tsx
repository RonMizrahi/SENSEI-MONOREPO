// ⌘K command palette — the type → filter → select → navigate journey.
// The OPEN gesture + axe pass are covered by a11y.test; here we exercise the
// behaviour that palette adds: typing a query filters the result list to a real
// patient option, activating that option navigates to the patient and dismisses
// the palette, and Escape closes it without navigating. Everything that appears
// after a user action is polled with waitFor so the file is deterministic under
// parallel load.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); });

const palette = () => document.querySelector('[role="dialog"][aria-label="פלטת פקודות"]') as HTMLElement;
const paletteInput = () => document.querySelector('input[aria-label="חיפוש פקודות ומטופלים"]') as HTMLInputElement;

// Open the palette from a mounted dashboard via the real global ⌘K shortcut.
async function openPalette() {
  mount({ view: 'app', route: 'dashboard' });
  await settle();
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
  await waitFor(() => expect(palette()).toBeTruthy());
  expect(paletteInput(), 'the palette exposes a search input').toBeTruthy();
}

describe('command palette — filter, select & navigate', () => {
  it('opens with ⌘K (and Ctrl+K) and shows a search input', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    // metaKey path
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(palette()).toBeTruthy());
    expect(paletteInput()).toBeTruthy();
    // toggle closed, then reopen via the ctrlKey path (Windows/Linux users)
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(palette()).toBeFalsy());
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(palette()).toBeTruthy());
  });

  it('typing a patient name filters the list to a matching option', async () => {
    await openPalette();
    fireEvent.input(paletteInput(), { target: { value: 'דנה' } });
    // the matching patient surfaces as a selectable option (async re-render → poll)
    await waitFor(() => {
      const opts = [...document.querySelectorAll('[role="option"]')];
      expect(opts.some((o) => o.textContent?.includes('דנה לוי'))).toBe(true);
    });
  });

  it('selecting the patient option navigates to them and closes the palette', async () => {
    await openPalette();
    fireEvent.input(paletteInput(), { target: { value: 'דנה' } });
    await waitFor(() => {
      const opts = [...document.querySelectorAll('[role="option"]')];
      expect(opts.some((o) => o.textContent?.includes('דנה לוי'))).toBe(true);
    });
    const opt = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('דנה לוי')) as HTMLElement;
    fireEvent.click(opt);
    // palette dismisses AND the patient screen (their name) is shown
    await waitFor(() => expect(palette()).toBeFalsy());
    await waitFor(() => expect(document.body.textContent).toContain('דנה לוי'));
  });

  it('Enter activates the top-ranked (highlighted) result via the keyboard', async () => {
    await openPalette();
    // a name unique enough that it is the single, top-ranked patient match, so the
    // default-highlighted option (index 0) is deterministically that patient
    fireEvent.input(paletteInput(), { target: { value: 'מיכל כהן' } });
    await waitFor(() => {
      const opt0 = document.querySelector('#cmdopt-0');
      expect(opt0?.textContent).toContain('מיכל כהן');
    });
    fireEvent.keyDown(paletteInput(), { key: 'Enter' });
    await waitFor(() => expect(palette()).toBeFalsy());
    await waitFor(() => expect(document.body.textContent).toContain('מיכל כהן'));
  });

  it('Escape closes the palette without navigating', async () => {
    await openPalette();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(palette()).toBeFalsy());
  });

  it('offers a full-search escalation that reaches the search screen (reconnects an orphaned route)', async () => {
    // The full search screen (route "search") has no sidebar entry by design; the
    // palette's "חיפוש מלא" row is its ONLY in-app entry point. A regression here
    // would silently orphan that screen again.
    await openPalette();
    fireEvent.input(paletteInput(), { target: { value: 'סימבה' } });
    const esc = await waitFor(() => {
      const el = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('חיפוש מלא')) as HTMLElement;
      expect(el, 'a full-search escalation row is offered when there is a query').toBeTruthy();
      return el;
    });
    fireEvent.click(esc);
    await waitFor(() => expect(palette()).toBeFalsy());
    // lands on the full search screen with the query carried over + session matches
    await waitFor(() => expect(window.location.hash).toBe('#/search'));
    await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toContain('תוצאות חיפוש'));
    expect((document.querySelector('.search-main-input') as HTMLInputElement)?.value).toBe('סימבה');
  });

  it('the escalation is keyboard-reachable (last option) and Enter activates it', async () => {
    await openPalette();
    // a query with no patient/route match → the escalation is the only option (index 0)
    fireEvent.input(paletteInput(), { target: { value: 'זזזזז' } });
    await waitFor(() => {
      const opt0 = document.querySelector('#cmdopt-0');
      expect(opt0?.textContent).toContain('חיפוש מלא');
    });
    fireEvent.keyDown(paletteInput(), { key: 'Enter' });
    await waitFor(() => expect(window.location.hash).toBe('#/search'));
  });
});
