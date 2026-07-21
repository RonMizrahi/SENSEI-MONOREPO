// Calendar drag-and-drop: dragging a locally-scheduled appointment onto a day
// column reschedules it in place (updates date/time), without creating a duplicate.
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

describe('calendar drag-and-drop', () => {
  it('reschedules a scheduled appointment on drop (in place, no duplicate)', async () => {
    const appt = { id: 'drag-1', pid: 'p1', date: todayKey(), time: '10:00', dur: 50, description: 'פגישה שבועית', status: 'upcoming' };
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true, scheduledAppts: [appt] });
    await settle();
    const ev = await waitFor(() => document.querySelector('.calh-event') as HTMLElement);
    expect(ev.getAttribute('draggable')).toBe('true'); // local appt is draggable
    const column = ev.parentElement as HTMLElement; // the day column is the drop target

    fireEvent.dragStart(ev);
    fireEvent.dragOver(column, { clientY: 5 });
    fireEvent.drop(column, { clientY: 5 }); // near the top → first slot (jsdom rect is 0)

    // jsdom getBoundingClientRect is 0 → the drop snaps to the day's first slot (08:00);
    // the point is the existing appointment moved and wasn't duplicated.
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(PKEY) || '{}');
      const appts = stored.scheduledAppts || [];
      expect(appts.filter((a: any) => a.id === 'drag-1').length).toBe(1);
      expect(appts.find((a: any) => a.id === 'drag-1')?.time).toBe('08:00');
    }, { timeout: 2000 });
  });
});
