// Copy-to-clipboard + the global Snackbar toast. The clinical-letter page's "העתקה"
// button copies the assembled letter text via the store's copyToClipboard(), which
// writes to navigator.clipboard and announces success through the global toast
// (role="alert", aria-live). We verify the real writeText call receives the letter
// body, the success toast is announced, and the toast's dismiss control removes it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
const byText = (t: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t)) as HTMLElement;
const toast = () => document.querySelector('[role="alert"]') as HTMLElement;

afterEach(() => { cleanup(); localStorage.clear(); });

async function openLetter() {
  // jsdom has no navigator.clipboard — provide a resolving stub so the success path runs.
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  mount({ view: 'app', route: 'letter', patientId: 'p1' });
  await settle();
  // the copy button on the clinical-letter page
  await waitFor(() => expect(byText('העתקה')).toBeTruthy());
  return writeText;
}

describe('copy-to-clipboard — clinical letter + success toast', () => {
  it('copies the letter text to the clipboard and announces a success toast', async () => {
    const writeText = await openLetter();
    fireEvent.click(byText('העתקה'));

    // the real clipboard API was called with the assembled letter body (async render → poll)
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('הנדון: סיכום טיפול'); // letter heading line
    expect(copied).toContain('דנה לוי');            // p1's name appears in the body

    // a success toast is announced to assistive tech
    await waitFor(() => expect(toast()).toBeTruthy());
    expect(toast().getAttribute('aria-live')).toBe('assertive');
    expect(toast().textContent).toContain('המכתב הועתק ללוח');
  });

  it('the success toast can be dismissed via its close control', async () => {
    await openLetter();
    fireEvent.click(byText('העתקה'));
    await waitFor(() => expect(toast()).toBeTruthy());

    // the toast exposes a labelled dismiss control (role="button")
    const dismiss = toast().querySelector('[aria-label="סגירת הודעה"]') as HTMLElement;
    expect(dismiss, 'the toast offers a dismiss control').toBeTruthy();
    fireEvent.click(dismiss);

    // dismissing removes the toast entirely
    await waitFor(() => expect(toast()).toBeFalsy());
  });
});
