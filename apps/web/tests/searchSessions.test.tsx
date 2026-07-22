// Regression: unified search must return SESSION matches, not just patients.
// Before the fix, SearchPage's local buildSessions() hardcoded `n = 0`, so the
// loop never ran and the "פגישות" category was always empty — session search
// silently returned nothing despite the advertised "חיפוש מטופלים ופגישות".
// SearchPage now reuses the canonical buildPatientSessions() (single source of
// truth), so a query matching a session summary surfaces real results.
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

describe('unified search — session results', () => {
  it('surfaces session-summary matches (not only patients)', async () => {
    // searchQuery isn't persisted, so drive it through the real input.
    mount({ view: 'app', route: 'search' });
    await settle();
    const input = document.querySelector('.search-main-input') as HTMLInputElement;
    // "סרעפתית" appears only in a session summary, never in a patient name/phone,
    // so finding it proves the sessions pipeline actually produced results.
    fireEvent.change(input, { target: { value: 'סרעפתית' } });
    await waitFor(() => expect(document.body.textContent).toContain('סרעפתית'));
  });
});
