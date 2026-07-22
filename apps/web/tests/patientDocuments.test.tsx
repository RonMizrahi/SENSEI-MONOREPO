// Patient Profile — Documents section: the built-in clinical letter plus a real
// add/categorize/delete flow for uploaded documents (metadata persisted).
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

const doc = { id: 'd1', name: 'הפניה_רופא.pdf', category: 'אחר', addedAt: '2026-07-01T10:00:00Z', size: 1200 };

describe('patient profile — documents section', () => {
  it('shows the clinical letter and an upload control', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('מסמכים'));
    expect(document.body.textContent).toContain('מכתב קליני');
    expect(document.querySelector('[aria-label="העלאת מסמך"]'), 'upload control').toBeTruthy();
    // clinical letter is openable
    expect(document.querySelector('[aria-label="פתיחת המכתב הקליני"]')).toBeTruthy();
  });

  it('lists an uploaded document with categorize + delete, and deletes it', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1', documentsByPatient: { p1: [doc] } });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הפניה_רופא.pdf'));
    // categorization is available
    expect(document.querySelector('[aria-label="קטגוריה · הפניה_רופא.pdf"]')).toBeTruthy();
    // delete removes it from the store
    fireEvent.click(document.querySelector('[aria-label="מחיקת הפניה_רופא.pdf"]') as HTMLElement);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(PKEY) || '{}');
      expect((stored.documentsByPatient?.p1 || []).length).toBe(0);
    }, { timeout: 2000 });
  });
});
