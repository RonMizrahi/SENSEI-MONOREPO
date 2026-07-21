// Session History — the canonical directory: all patients (active + archived)
// A–Z with search; a row opens that patient's full history (the same screen).
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

const archived = { id: 'pz', name: 'אבשלום ארכיוני', phone: '050-0000000', email: null, created_at: '2024-01-01T10:00:00Z', archived_at: '2024-09-01T10:00:00Z', archived: true };

describe('session history — canonical patient directory', () => {
  it('lists active + archived patients with search, and opens a patient history on click', async () => {
    mount({ view: 'app', route: 'meetingHistory', patientId: null, archivedPatients: [archived] });
    await settle();
    await waitFor(() => expect(document.querySelectorAll('.mh-dir-row').length).toBeGreaterThan(1));
    // archived patients are included (labelled)
    expect(document.body.textContent).toContain('אבשלום ארכיוני');
    expect(document.body.textContent).toContain('ארכיון');

    // search filters the list
    const search = document.querySelector('[aria-label="חיפוש מטופל"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'אבשלום' } });
    await waitFor(() => expect(document.querySelectorAll('.mh-dir-row').length).toBe(1));

    // clicking opens that patient's full history (same screen)
    fireEvent.click(document.querySelector('.mh-dir-row') as HTMLElement);
    await waitFor(() => {
      expect(document.body.textContent).toContain('אבשלום ארכיוני');
      expect(document.querySelector('.mh-dir-row'), 'left the directory').toBeFalsy();
    });
  });

  it('is A–Z sorted', async () => {
    mount({ view: 'app', route: 'meetingHistory', patientId: null, archivedPatients: [archived] });
    await settle();
    const names = [...document.querySelectorAll('.mh-dir-row')].map((r) => r.getAttribute('data-name') || '');
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'he'));
    expect(names).toEqual(sorted);
  });
});
