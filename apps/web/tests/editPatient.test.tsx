// Edit-patient flow — prefilled dialog & rename.
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

const PATIENTS = [
  { id: 'p1', name: 'דנה לוי', phone: '054-1234567', email: 'dana@mail.com', created_at: '2025-01-15T10:00:00Z' },
  { id: 'p2', name: 'יוסי מזרחי', phone: '052-7654321', email: 'yossi@mail.com', created_at: '2024-09-01T10:00:00Z' },
];

const dialog = () => document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
const nameField = () => document.querySelector('[data-field="name"]') as HTMLInputElement;
const list = () => document.querySelector('#main-content') as HTMLElement;
const firstEditBtn = () => document.querySelector('[aria-label="עריכת מטופל"]') as HTMLElement;
const saveBtn = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('שמירת שינויים')) as HTMLElement;

async function openEditFirst() {
  mount({ view: 'app', route: 'patients', patients: PATIENTS });
  await settle();
  await waitFor(() => expect(firstEditBtn()).toBeTruthy());
  fireEvent.click(firstEditBtn());
  await waitFor(() => expect(dialog()).toBeTruthy());
  return dialog();
}

describe('edit patient — prefilled dialog & rename', () => {
  it('opens a modal prefilled with the patient\'s existing name', async () => {
    await openEditFirst();
    expect(dialog().textContent).toContain('עריכת מטופל');
    expect(saveBtn()).toBeTruthy();
    const val = nameField().value;
    expect(val).toBeTruthy();
    expect(PATIENTS.map((p) => p.name)).toContain(val);
  });

  it('renaming and saving closes the dialog and shows the new name in the roster', async () => {
    await openEditFirst();
    const oldName = nameField().value;
    const newName = 'שם חדש לבדיקה';

    fireEvent.input(nameField(), { target: { value: newName } });
    await waitFor(() => expect(nameField().value).toBe(newName));
    fireEvent.click(saveBtn());

    await waitFor(() => expect(dialog(), 'dialog closes after save').toBeFalsy());
    await waitFor(() => expect(list().textContent, 'renamed patient appears').toContain(newName));
    expect(list().textContent, 'the old name is replaced').not.toContain(oldName);
  });
});
