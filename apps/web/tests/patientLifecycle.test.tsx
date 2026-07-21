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

  it('active patients are archived (not permanently deleted) from the detail page', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    // Spec: active files are archived (reversible), never hard-deleted.
    expect(document.querySelector('[aria-label="מחיקת מטופל לצמיתות"]'), 'no permanent-delete on an active file').toBeFalsy();
    expect(document.querySelector('[aria-label="העברת מטופל לארכיון"]'), 'archive is offered instead').toBeTruthy();
  });

  it('permanently deletes an ARCHIVED patient from the detail page', async () => {
    const archived = { id: 'pz', name: 'רון ארכיון', phone: '050-0000000', email: null, created_at: '2024-01-01T10:00:00Z', archived_at: '2024-09-01T10:00:00Z', archived: true };
    mount({ view: 'app', route: 'patient', patientId: 'pz', archivedPatients: [archived] });
    await settle();
    const deleteBtn = document.querySelector('[aria-label="מחיקת מטופל לצמיתות"]') as HTMLElement;
    expect(deleteBtn, 'permanent delete is available on an archived file').toBeTruthy();
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(dialog()).toBeTruthy());
    expect(dialog().textContent).toContain('מחיקת מטופל לצמיתות');
    fireEvent.click(byText('מחיקה לצמיתות'));
    await waitFor(() => expect(dialog()).toBeFalsy());
    // the archived file is gone from the store
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('sensei_session_react_v1') || '{}');
      expect((stored.archivedPatients || []).some((p: any) => p.id === 'pz')).toBe(false);
    }, { timeout: 2000 });
  });

  it('permanent delete purges the patient\'s references (no orphans left behind) — R-1', async () => {
    const archived = { id: 'pz', name: 'רון ארכיון', phone: '050-0000000', email: null, created_at: '2024-01-01T10:00:00Z', archived_at: '2024-09-01T10:00:00Z', archived: true };
    mount({
      view: 'app', route: 'patient', patientId: 'pz', archivedPatients: [archived],
      scheduledAppts: [{ id: 'ax', pid: 'pz', date: '2025-01-01', time: '10:00' }, { id: 'ay', pid: 'p1', date: '2025-01-02', time: '11:00' }],
      notesOverrides: { pz: 'note', p1: 'keep' },
      sessionNotes: { 'pz_1': 'n', 'p1_1': 'm' },
      recentPatientIds: ['pz', 'p1'],
    });
    await settle();
    fireEvent.click(document.querySelector('[aria-label="מחיקת מטופל לצמיתות"]') as HTMLElement);
    await waitFor(() => expect(dialog()).toBeTruthy());
    fireEvent.click(byText('מחיקה לצמיתות'));
    await waitFor(() => expect(dialog()).toBeFalsy());
    await waitFor(() => {
      const s = JSON.parse(localStorage.getItem('sensei_session_react_v1') || '{}');
      // every pz reference is gone…
      expect((s.scheduledAppts || []).some((a: any) => a.pid === 'pz'), 'no orphaned appointment').toBe(false);
      expect(s.notesOverrides?.pz, 'no orphaned note override').toBeUndefined();
      expect(s.sessionNotes?.['pz_1'], 'no orphaned session note').toBeUndefined();
      expect((s.recentPatientIds || []).includes('pz'), 'not in recents').toBe(false);
      // …while other patients are untouched
      expect((s.scheduledAppts || []).some((a: any) => a.pid === 'p1')).toBe(true);
      expect(s.notesOverrides?.p1).toBe('keep');
      expect(s.sessionNotes?.['p1_1']).toBe('m');
    }, { timeout: 2000 });
  });
});
