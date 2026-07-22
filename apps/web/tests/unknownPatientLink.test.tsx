// A URL naming an UNKNOWN patient (deleted since it was shared/bookmarked, or
// hand-edited) must NOT resolve to a different patient via getPatient's
// patients[0] fallback — that would render someone else's clinical file under
// the wrong URL. Both deep-link vectors land on the roster with an honest
// notice; valid links keep working.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
const settle = (ms = 150) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

describe('deep link to an unknown patient', () => {
  it('MOUNT vector: a bookmarked URL to a deleted patient lands on the roster with a notice', async () => {
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard' }));
    window.location.hash = '#/patient/p999';
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    await waitFor(() => expect(window.location.hash).toBe('#/patients'), { timeout: 3000 });
    // never rendered another patient's file under the stale URL
    expect(document.querySelector('#main-content h1')?.textContent).toBe('מטופלים');
    await waitFor(() => expect(document.body.textContent).toContain('המטופל שבקישור לא נמצא'), { timeout: 2000 });
  });

  it('RUNTIME vector: editing the hash to an unknown patient redirects to the roster', async () => {
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard' }));
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    act(() => { window.location.hash = '#/patient/p999'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await waitFor(() => expect(window.location.hash).toBe('#/patients'), { timeout: 3000 });
    await waitFor(() => expect(document.body.textContent).toContain('המטופל שבקישור לא נמצא'));
  });

  it('control: a VALID patient deep link still opens that patient', async () => {
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'dashboard' }));
    window.location.hash = '#/patient/p2';
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toBe('יוסי מזרחי'), { timeout: 3000 });
    expect(window.location.hash).toBe('#/patient/p2');
  });
});
