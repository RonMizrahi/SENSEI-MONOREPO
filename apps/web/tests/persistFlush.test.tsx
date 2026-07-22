// Unload flush — the store's localStorage persistence is debounced (500ms), so
// a reload/close right after a change (e.g. the stale-chunk auto-reload, or the
// user closing the tab mid-note) would drop the last keystrokes. pagehide /
// beforeunload must flush the CURRENT state synchronously before the page goes.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
const settle = (ms = 130) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

describe('persistence — synchronous flush on page unload', () => {
  it('a tab with NOTHING pending does not overwrite storage on unload (multi-tab safety)', async () => {
    // Another tab (or tooling) may have written newer state; a clean tab closing
    // must not clobber it with its own stale snapshot.
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard' }));
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle(800); // let any startup writes finish
    const newer = JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard', notesDrafts: { p9: 'נכתב מלשונית אחרת' } });
    localStorage.setItem(PKEY, newer); // simulates a newer write from another tab
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(localStorage.getItem(PKEY), 'clean unload must not clobber the newer write').toBe(newer);
  });

  it('pagehide persists un-debounced changes immediately (no 500ms loss window)', async () => {
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'patient', patientId: 'p1' }));
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    // start a note and type — WITHOUT waiting out the persistence debounce
    await waitFor(() => expect(document.querySelector('[aria-label="הוספת הערה"]')).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(document.querySelector('[aria-label="הוספת הערה"]') as HTMLElement);
    await settle(30);
    fireEvent.change(document.querySelector('textarea[aria-label="הערות המטפל"]') as HTMLTextAreaElement, { target: { value: 'שורה אחרונה שהוקלדה ממש לפני רענון' } });
    // fire pagehide immediately (inside the debounce window)
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    const stored = JSON.parse(localStorage.getItem(PKEY) || '{}');
    expect(stored.notesDrafts?.p1, 'the in-progress draft survived an immediate unload').toBe('שורה אחרונה שהוקלדה ממש לפני רענון');
  });
});
