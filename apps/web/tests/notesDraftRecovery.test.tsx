// Clinical-notes draft recovery — the same work-loss protection as the summary
// editor, applied to per-patient clinical notes. An interruption mid-edit (a
// notification, the palette, any navigation) must not silently lose the note;
// on return a recovery banner offers to resume. Guards capture → survive
// interruption → resume/discard → no-phantom-after-cancel.
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

const editTrigger = () => document.querySelector('[aria-label="עריכת הערות קליניות"]') as HTMLElement;
const notesArea = () => document.querySelector('textarea[aria-label="הערות קליניות"]') as HTMLTextAreaElement;
const banner = 'יש טיוטה שלא נשמרה מעריכה קודמת';
const DRAFT = 'הערה קלינית שהתחלתי ואסור שתאבד באמצע עבודה';

async function openPatient() {
  mount();
  await settle();
  await waitFor(() => expect(editTrigger()).toBeTruthy(), { timeout: 3000 });
}
async function typeDraftAndInterrupt() {
  fireEvent.click(editTrigger());
  await settle();
  fireEvent.change(notesArea(), { target: { value: DRAFT } });
  await settle(700); // ride the 500ms debounced persist
  cleanup();
  render(<AppStoreProvider><App /></AppStoreProvider>); // interruption = fresh mount
  await settle();
}

describe('clinical-notes draft recovery', () => {
  it('an in-progress note survives an interruption and offers recovery on return', async () => {
    await openPatient();
    fireEvent.click(editTrigger());
    await settle();
    fireEvent.change(notesArea(), { target: { value: DRAFT } });
    await settle(700);
    expect(JSON.parse(localStorage.getItem(PKEY) || '{}').notesDrafts?.p1, 'draft persisted per patient').toBe(DRAFT);
    cleanup();
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain(banner));
    expect(notesArea(), 'not auto-reopened — the user chooses').toBeFalsy();
  });

  it('"המשך עריכה" resumes from the recovered draft; saving clears it', async () => {
    await openPatient();
    await typeDraftAndInterrupt();
    await waitFor(() => expect(document.body.textContent).toContain(banner));
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'המשך עריכה') as HTMLElement);
    await settle();
    expect(notesArea()?.value).toBe(DRAFT);
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'שמירה') as HTMLElement);
    await settle();
    expect(document.body.textContent).not.toContain(banner);
    expect(document.body.textContent).toContain(DRAFT); // saved into the notes
  });

  it('"מחיקת הטיוטה" discards the draft and removes the banner', async () => {
    await openPatient();
    await typeDraftAndInterrupt();
    await waitFor(() => expect(document.body.textContent).toContain(banner));
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'מחיקת הטיוטה') as HTMLElement);
    await settle();
    expect(document.body.textContent).not.toContain(banner);
  });

  it('cancelling an edit leaves no phantom recovery draft', async () => {
    await openPatient();
    fireEvent.click(editTrigger());
    await settle();
    fireEvent.change(notesArea(), { target: { value: DRAFT } });
    await settle();
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'ביטול') as HTMLElement);
    await settle(700);
    cleanup();
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    expect(document.body.textContent).not.toContain(banner);
  });
});
