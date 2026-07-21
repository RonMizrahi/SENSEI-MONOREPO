// Spec 3.6 — the between-session notes timeline in the patient file: add a dated
// entry, see it listed with a date, delete an entry, and confirm a legacy single-
// blob note is migrated (shown, non-destructively) rather than lost.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any> = {}) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'patient', patientId: 'p1', ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = (ms = 130) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); });

const addTrigger = () => document.querySelector('[aria-label="הוספת הערה"]') as HTMLElement;
const notesArea = () => document.querySelector('textarea[aria-label="הערות המטפל"]') as HTMLTextAreaElement;
const btn = (t: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === t) as HTMLElement;
const notesCard = () => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'הערות המטפל')!.closest('div')!.parentElement as HTMLElement;

describe('therapist notes timeline (spec 3.6)', () => {
  it('adds a dated entry that appears in the timeline and persists', async () => {
    mount();
    await settle();
    await waitFor(() => expect(addTrigger()).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(addTrigger());
    await settle();
    fireEvent.change(notesArea(), { target: { value: 'המטופל דיווח על שיפור בשינה' } });
    await settle();
    fireEvent.click(btn('שמירה'));
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('המטופל דיווח על שיפור בשינה'));
    // persisted as a timeline entry (not the legacy blob key)
    await waitFor(() => {
      const s = JSON.parse(localStorage.getItem(PKEY) || '{}');
      const list = s.therapistNotes?.p1 || [];
      expect(list.length).toBe(1);
      expect(list[0].text).toBe('המטופל דיווח על שיפור בשינה');
      expect(typeof list[0].at).toBe('string'); // dated
    }, { timeout: 2000 });
  });

  it('migrates a legacy single-blob note into the timeline (non-destructive)', async () => {
    mount({ notesOverrides: { p1: 'הערה קלינית ישנה מהמודל הקודם' } });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הערה קלינית ישנה מהמודל הקודם'));
    // adding a new note keeps the migrated legacy entry alongside it
    fireEvent.click(addTrigger());
    await settle();
    fireEvent.change(notesArea(), { target: { value: 'הערה חדשה' } });
    await settle();
    fireEvent.click(btn('שמירה'));
    await settle();
    await waitFor(() => {
      const list = JSON.parse(localStorage.getItem(PKEY) || '{}').therapistNotes?.p1 || [];
      expect(list.length).toBe(2); // new + migrated legacy
      expect(list.some((n: any) => n.text === 'הערה קלינית ישנה מהמודל הקודם')).toBe(true);
    }, { timeout: 2000 });
  });

  it('shows the latest 4 notes with an expander; expanding reveals all (progressive disclosure)', async () => {
    const notes = Array.from({ length: 6 }, (_, i) => ({ id: 'n' + i, text: 'הערה מספר ' + (i + 1), at: '2026-07-1' + i + 'T09:00:00Z' }));
    mount({ therapistNotes: { p1: notes } });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הערה מספר 1'));
    // only the first 4 (newest-first order of the stored array) are shown
    expect(document.body.textContent).toContain('הערה מספר 4');
    expect(document.body.textContent).not.toContain('הערה מספר 5');
    const expander = btn('הצגת כל ההערות (6) ›');
    expect(expander, 'expander names the total').toBeTruthy();
    fireEvent.click(expander);
    await settle();
    expect(document.body.textContent).toContain('הערה מספר 6');
    // collapse back
    fireEvent.click(btn('הצגת ההערות האחרונות בלבד'));
    await settle();
    expect(document.body.textContent).not.toContain('הערה מספר 6');
  });

  it('deletes an entry from the timeline', async () => {
    mount({ therapistNotes: { p1: [{ id: 'n1', text: 'הערה למחיקה', at: '2026-07-10T09:00:00Z' }] } });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הערה למחיקה'));
    fireEvent.click(notesCard().querySelector('[aria-label="מחיקת הערה"]') as HTMLElement);
    await settle();
    await waitFor(() => expect(document.body.textContent).not.toContain('הערה למחיקה'));
  });
});
