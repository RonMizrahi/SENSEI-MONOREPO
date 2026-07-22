// An archived patient's file is read-only for scheduling: no upload / schedule /
// prep buttons, "last meeting" instead of "next", and a restore action.
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

const archived = { id: 'pz', name: 'רון ארכיון', phone: '050-0000000', email: 'ron@mail.com', created_at: '2024-01-01T10:00:00Z', archived: true };

describe('patient file — archived variant', () => {
  it('hides scheduling actions and offers restore', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'pz', archivedPatients: [archived] });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('רון ארכיון'));
    // no scheduling affordances for an archived file
    expect(document.querySelector('[aria-label="העברת מטופל לארכיון"]')).toBeFalsy();
    expect(document.body.textContent).not.toContain('קביעת פגישה');
    // restore is offered, and the "last meeting" framing replaces "next meeting"
    expect(document.querySelector('[aria-label="שחזור מטופל לרשימת הפעילים"]')).toBeTruthy();
    expect(document.body.textContent).toContain('פגישה אחרונה');
  });
});
