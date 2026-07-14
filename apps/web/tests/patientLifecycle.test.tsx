// Destructive flow — deleting (archiving) a patient. A delete is guarded by a
// confirmation dialog (no one-click destruction), removes the record from the active
// list on confirm, and offers an immediate undo that restores it. Critical, high-risk
// journey; the name is read from the confirmation dialog so the assertions hold
// regardless of list sort order / pagination.
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

const list = () => document.querySelector('#main-content') as HTMLElement;
const firstDeleteBtn = () => document.querySelector('[aria-label="העברה לארכיון"]') as HTMLElement;
const dialog = () => document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
const byText = (t: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t)) as HTMLElement;

async function openDeleteConfirm() {
  mount({ view: 'app', route: 'patients' });
  await settle();
  await waitFor(() => expect(firstDeleteBtn()).toBeTruthy());
  fireEvent.click(firstDeleteBtn());
  await waitFor(() => expect(dialog()).toBeTruthy());
  // the name shown in the confirmation dialog is the record we are deleting
  const name = (dialog().querySelector('b')?.textContent || '').trim();
  expect(name, 'the confirmation names the patient being deleted').toBeTruthy();
  return name;
}

describe('delete patient — confirmation, removal, and undo', () => {
  it('requires confirmation and then removes the patient from the active list', async () => {
    const name = await openDeleteConfirm();
    expect(list().textContent).toContain(name); // present before confirming
    fireEvent.click(byText('העברה לארכיון'));
    await waitFor(() => expect(dialog(), 'dialog closes after confirming').toBeFalsy());
    await waitFor(() => expect(list().textContent, 'the deleted patient no longer appears').not.toContain(name));
  });

  it('offers an undo that restores the deleted patient', async () => {
    const name = await openDeleteConfirm();
    fireEvent.click(byText('העברה לארכיון'));
    await waitFor(() => expect(list().textContent).not.toContain(name));
    // the success toast offers "ביטול" (undo)
    const undo = byText('ביטול');
    expect(undo, 'an undo action is offered').toBeTruthy();
    fireEvent.click(undo);
    await settle();
    await waitFor(() => expect(list().textContent).toContain(name));
  });

  it('cancelling the dialog keeps the patient (no destruction without confirm)', async () => {
    const name = await openDeleteConfirm();
    // close via the cancel control (labelled) without confirming
    const cancel = byText('ביטול') || byText('חזרה');
    if (cancel) { fireEvent.click(cancel); await settle(); }
    else { fireEvent.keyDown(document, { key: 'Escape' }); await settle(); }
    expect(list().textContent, 'patient remains after cancelling').toContain(name);
  });

  it('permanently deletes from the patient detail page and returns to the list', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    const deleteBtn = document.querySelector('[aria-label="מחיקת מטופל לצמיתות"]') as HTMLElement;
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(dialog()).toBeTruthy());
    expect(dialog().textContent).toContain('מחיקת מטופל לצמיתות');
    const name = (dialog().querySelector('b')?.textContent || '').trim();
    fireEvent.click(byText('מחיקה לצמיתות'));
    await waitFor(() => expect(dialog()).toBeFalsy());
    await waitFor(() => expect(list().textContent).not.toContain(name));
    expect(document.body.textContent).toContain('מטופלים');
  });
});
