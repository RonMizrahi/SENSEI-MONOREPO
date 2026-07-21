// Patients list refresh — each row surfaces the patient's next appointment (or a
// clear "no scheduled appointment" state) for at-a-glance scannability.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });
function futureKey(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

describe('patients list — next appointment on each row', () => {
  it('surfaces the upcoming appointment time on the row', async () => {
    mount({ view: 'app', route: 'patients', scheduledAppts: [{ id: 'a1', pid: 'p1', date: futureKey(3), time: '14:25', dur: 50, description: '', status: 'upcoming' }] });
    await settle();
    const row = await waitFor(() => document.querySelector('[aria-label="דנה לוי"]')?.closest('.pat-row') as HTMLElement);
    expect(row.textContent).toContain('14:25'); // p1's next appointment surfaced on the row
  });

  it('shows a "no scheduled appointment" state when a patient has none', async () => {
    // A patient with no appointments and no mock appointments seeded for them.
    const solo = { id: 'solo', name: 'ניר בודד', phone: '050-9999999', email: null, created_at: '2025-01-01T10:00:00Z' };
    mount({ view: 'app', route: 'patients', patients: [solo], scheduledAppts: [{ id: 'x', pid: 'other', date: futureKey(2), time: '09:00', dur: 50, description: '', status: 'upcoming' }] });
    await settle();
    const row = await waitFor(() => document.querySelector('[aria-label="ניר בודד"]')?.closest('.pat-row') as HTMLElement);
    expect(row.textContent).toContain('אין פגישה מתוכננת');
  });
});
