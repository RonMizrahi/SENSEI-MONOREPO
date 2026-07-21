// Editing an appointment from the meeting-details dialog updates the existing
// appointment in place (not a duplicate), and the schedule dialog reflects edit mode.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 150)));
afterEach(() => { cleanup(); localStorage.clear(); });
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const btn = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLElement;

describe('edit appointment from the details dialog', () => {
  it('updates the existing appointment in place (no duplicate)', async () => {
    const appt = { id: 'appt-edit', pid: 'p1', date: todayKey(), time: '10:00', dur: 50, description: 'פגישה שבועית', status: 'upcoming' };
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [appt] });
    await settle();
    // open the meeting via the agenda row (opens the details dialog)
    fireEvent.click(await waitFor(() => document.querySelector('.calh-agenda-row') as HTMLElement));
    await waitFor(() => expect(btn('עריכת הפגישה')).toBeTruthy());
    fireEvent.click(btn('עריכת הפגישה'));
    // schedule dialog opens in edit mode
    await waitFor(() => expect(document.body.textContent).toContain('עריכת פגישה'));
    const timeInput = document.querySelector('[aria-label="שעת הפגישה"]') as HTMLInputElement;
    expect(timeInput.value).toBe('10:00'); // prefilled
    fireEvent.input(timeInput, { target: { value: '14:30' } });
    fireEvent.click(btn('שמירת שינויים'));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(PKEY) || '{}');
      const appts = stored.scheduledAppts || [];
      expect(appts.filter((a: any) => a.id === 'appt-edit').length).toBe(1); // still one, not duplicated
      expect(appts.find((a: any) => a.id === 'appt-edit')?.time).toBe('14:30'); // updated
    }, { timeout: 2000 });
  });
});
