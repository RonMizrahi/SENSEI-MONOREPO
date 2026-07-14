import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';

function mount(patch: Record<string, any>, hash = '') {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  window.history.replaceState(null, '', window.location.pathname + hash);
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
const byText = (t: string) => [...document.querySelectorAll('button, a[role="button"]')].find((el) => el.textContent?.includes(t)) as HTMLElement;
afterEach(() => { cleanup(); localStorage.clear(); });

describe('patient archive page', () => {
  it('shows archived patients and restores them to the active list', async () => {
    const archived = [{
      id: 'p9',
      name: 'ארכיון בדיקה',
      phone: '050-0000000',
      email: null,
      created_at: '2025-01-01T00:00:00Z',
      archived: true,
    }];
    mount({ view: 'app', route: 'patientArchive', archivedPatients: archived, patients: [] });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('ארכיון מטופלים'));
    expect(document.body.textContent).toContain('ארכיון בדיקה');
    fireEvent.click(document.querySelector('[aria-label="שחזור מטופל"]') as HTMLElement);
    await waitFor(() => expect(document.body.textContent).not.toContain('ארכיון בדיקה'));
    fireEvent.click(byText('חזרה למטופלים פעילים'));
    await waitFor(() => expect(document.querySelector('#main-content h1')?.textContent).toContain('מטופלים'));
    await waitFor(() => expect(document.body.textContent).toContain('ארכיון בדיקה'));
  });

  it('moves a patient to archive from the patients list', async () => {
    mount({ view: 'app', route: 'patients' });
    await settle();
    await waitFor(() => expect(document.querySelector('[aria-label="העברה לארכיון"]')).toBeTruthy());
    const name = (document.querySelector('.pat-row button[aria-label]')?.getAttribute('aria-label') || '').trim();
    fireEvent.click(document.querySelector('[aria-label="העברה לארכיון"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    fireEvent.click(byText('העברה לארכיון'));
    await waitFor(() => expect(document.body.textContent).not.toContain(name));
    fireEvent.click(byText('ארכיון מטופלים'));
    await act(() => new Promise((r) => setTimeout(r, 350)));
    await waitFor(() => expect(document.body.textContent).toContain(name));
  });

  it('permanently deletes an archived patient after confirmation', async () => {
    const archived = [{
      id: 'p9',
      name: 'למחיקה לצמיתות',
      phone: '050-0000000',
      email: null,
      created_at: '2025-01-01T00:00:00Z',
      archived: true,
    }];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      mount({ view: 'app', route: 'patientArchive', archivedPatients: archived, patients: [] }, '#/patientArchive');
      await settle();
      fireEvent.click(document.querySelector('[aria-label="מחיקת מטופל לצמיתות"]') as HTMLElement);
      const dialog = await waitFor(() => document.querySelector('[role="dialog"]') as HTMLElement);
      expect(dialog.textContent).toContain('מחיקת מטופל לצמיתות');
      await act(async () => {
        fireEvent.click([...dialog.querySelectorAll('button')].find((b) => b.textContent === 'מחיקה לצמיתות') as HTMLElement);
      });
      await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeFalsy());
      expect(document.body.textContent).not.toContain('למחיקה לצמיתות');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
