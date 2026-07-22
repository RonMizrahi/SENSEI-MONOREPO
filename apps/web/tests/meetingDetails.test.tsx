// Clicking a meeting on the week-view home must open the meeting-DETAILS dialog
// (with a recap + per-meeting actions), not jump straight to the Patients tab.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('home — meeting details on click', () => {
  it('opens the meeting-details dialog with recap + prep-report + upload actions', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    const event = await waitFor(() => {
      const el = document.querySelector('.calh-event') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    fireEvent.click(event);
    // a modal dialog (not a navigation to the patient file)
    const dialog = await waitFor(() => {
      const d = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(d).toBeTruthy();
      return d;
    });
    const txt = dialog.textContent || '';
    expect(txt).toContain('מהפגישה הקודמת'); // recap
    expect(txt).toContain('דוח הכנה');        // prep-report action
    expect(txt).toContain('העלאת הקלטה');      // upload-for-this-meeting action
    expect(txt).toContain('מעבר לתיק המטופל');  // still can open the file
  });
});
