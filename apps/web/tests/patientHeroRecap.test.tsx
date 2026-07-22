// Patient file hero: a visible one-line "מהפגישה הקודמת" recap answers "what
// changed since the last session" without opening the history. Hidden for
// archived patients (their hero shows the last-session line instead).
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 150)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

describe('patient file — previously-on recap in the hero', () => {
  it('shows a trimmed "מהפגישה הקודמת" line for an active patient', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('מהפגישה הקודמת:'));
    // trimmed to one line (≤131 chars + ellipsis handled by the same rule as home)
    const p = [...document.querySelectorAll('p')].find((el) => el.textContent?.startsWith('מהפגישה הקודמת:'))!;
    expect(p.textContent!.length).toBeLessThanOrEqual('מהפגישה הקודמת: '.length + 131);
  });
});
