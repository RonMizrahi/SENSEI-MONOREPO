// Patients roster — inline search + sort control (previously the list had neither,
// so a growing roster couldn't be filtered or reordered from the page).
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });
const names = () => [...document.querySelectorAll('.pat-row > button[aria-label]')].map((b) => b.getAttribute('aria-label'));

describe('patients list — search + sort', () => {
  it('filters the roster by the search query and offers a clear action', async () => {
    mount({ view: 'app', route: 'patients' });
    await settle();
    await waitFor(() => expect(document.querySelectorAll('.pat-row').length).toBe(5));
    const search = document.querySelector('[aria-label="חיפוש מטופלים"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'דנה' } });
    await waitFor(() => expect(document.querySelectorAll('.pat-row').length).toBe(1));
    expect(document.body.textContent).toContain('דנה לוי');

    // no-match → recovery
    fireEvent.change(search, { target: { value: 'zzzzzz' } });
    await waitFor(() => expect(document.body.textContent).toContain('לא נמצאו מטופלים'));
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'ניקוי החיפוש') as HTMLElement);
    await waitFor(() => expect(document.querySelectorAll('.pat-row').length).toBe(5));
  });

  it('reorders the roster A–Z vs most-recent', async () => {
    mount({ view: 'app', route: 'patients', sortBy: 'name' });
    await settle();
    await waitFor(() => expect(document.querySelectorAll('.pat-row').length).toBe(5));
    const az = names();
    expect(az).toEqual([...az].sort((a, b) => (a || '').localeCompare(b || '', 'he')));
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'לאחרונה') as HTMLElement);
    await waitFor(() => expect(names()).not.toEqual(az));
  });
});
