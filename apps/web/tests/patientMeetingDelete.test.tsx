// Meeting history — delete recorded session from the full history page.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>, hash = '') {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  window.history.replaceState(null, '', window.location.pathname + hash);
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
const byText = (t: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t)) as HTMLElement;
afterEach(() => { cleanup(); localStorage.clear(); });

describe('meeting history delete', () => {
  it('removes a recorded session after confirmation', async () => {
    mount({ view: 'app', route: 'meetingHistory', patientId: 'p1' }, '#/meetingHistory/p1');
    await settle();
    await waitFor(() => expect(document.querySelector('.pd-sess-row')).toBeTruthy());
    const before = document.querySelectorAll('.pd-sess-row').length;
    fireEvent.click(document.querySelector('[aria-label^="מחיקת פגישה"]') as HTMLElement);
    await waitFor(() => expect(document.body.textContent).toContain('מחיקת פגישה'));
    fireEvent.click(byText('מחיקת הפגישה'));
    await waitFor(() => expect(document.querySelectorAll('.pd-sess-row').length).toBe(before - 1));
  });
});
