// Clinical summary draft recovery — a therapist editing an AI summary who is
// interrupted (a notification, the command palette, any navigation) must not
// silently lose their wording. In-progress edits are auto-captured per patient
// (S.summaryDrafts, persisted); on return a recovery banner offers to resume.
// Guards the whole lifecycle: capture → survive interruption → recover → clear.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any> = {}) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'summary', patientId: 'p1', ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = (ms = 120) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); });

const editBtn = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'עריכה') as HTMLElement;
const textarea = () => document.querySelector('textarea[aria-label="עריכת תקציר הסיכום"]') as HTMLTextAreaElement;
const bannerText = 'יש טיוטה שלא נשמרה מעריכה קודמת';

const DRAFT = 'עריכה קלינית שהתחלתי ואסור שתאבד באמצע';

async function openSummary() {
  mount();
  await settle();
  await waitFor(() => expect(editBtn()).toBeTruthy(), { timeout: 3000 });
}

describe('summary draft recovery', () => {
  it('an in-progress edit survives an interruption and offers recovery on return', async () => {
    await openSummary();
    fireEvent.click(editBtn());
    await settle();
    fireEvent.change(textarea(), { target: { value: DRAFT } });
    // let the 500ms debounced persister write the draft
    await settle(700);
    expect(JSON.parse(localStorage.getItem(PKEY) || '{}').summaryDrafts?.p1, 'draft persisted per patient').toBe(DRAFT);

    // interruption: a full remount (tab closed / navigated away) — editing state
    // is transient, so it is gone, but the persisted draft must resurface
    cleanup();
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain(bannerText));
    expect(textarea(), 'not auto-reopened into edit mode — the user chooses').toBeFalsy();
  });

  it('"המשך עריכה" resumes editing from the recovered draft; saving clears it', async () => {
    await openSummary();
    fireEvent.click(editBtn());
    await settle();
    fireEvent.change(textarea(), { target: { value: DRAFT } });
    await settle(700);
    cleanup();
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain(bannerText));

    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'המשך עריכה') as HTMLElement);
    await settle();
    expect(textarea()?.value, 'resumes from the saved draft').toBe(DRAFT);
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'שמירת השינויים') as HTMLElement);
    await settle();
    expect(document.body.textContent).not.toContain(bannerText);
    expect(document.body.textContent).toContain(DRAFT); // saved into the summary
  });

  it('"מחיקת הטיוטה" discards the draft and removes the banner', async () => {
    await openSummary();
    fireEvent.click(editBtn());
    await settle();
    fireEvent.change(textarea(), { target: { value: DRAFT } });
    await settle(700);
    cleanup();
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain(bannerText));
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'מחיקת הטיוטה') as HTMLElement);
    await settle();
    expect(document.body.textContent).not.toContain(bannerText);
  });

  it('cancelling an edit does NOT leave a phantom recovery draft', async () => {
    await openSummary();
    fireEvent.click(editBtn());
    await settle();
    fireEvent.change(textarea(), { target: { value: DRAFT } });
    await settle();
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'ביטול') as HTMLElement);
    await settle(700);
    cleanup();
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await settle();
    expect(document.body.textContent).not.toContain(bannerText);
  });
});
