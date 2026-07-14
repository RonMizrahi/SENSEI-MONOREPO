// Next-meeting report launcher — patient picker and generate flow.
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

describe('next meeting report launcher', () => {
  it('shows patient selector and generate button in the sidebar route', async () => {
    mount({ view: 'app', route: 'nextMeetingReport' });
    await settle();
    expect(document.querySelector('#main-content h1')?.textContent).toContain('דוח לפגישה הבאה');
    expect(document.querySelector('#nmr-patient')).toBeTruthy();
    expect(document.querySelector('[aria-label="יצירת דוח הכנה"]')).toBeTruthy();
  });

  it('generates the prep report for the selected patient', async () => {
    mount({ view: 'app', route: 'nextMeetingReport', patientId: 'p1' });
    await settle();
    fireEvent.click(document.querySelector('[aria-label="יצירת דוח הכנה"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toContain('דוח הכנה לפגישה'));
  });
});
