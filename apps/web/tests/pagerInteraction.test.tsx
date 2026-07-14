// Patients roster — all active patients render without pagination.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); });

const archiveBtns = () => [...document.querySelectorAll('[aria-label="העברה לארכיון"]')];

async function mountPatients() {
  mount({ view: 'app', route: 'patients' });
  await settle();
  await waitFor(() => expect(archiveBtns().length).toBeGreaterThan(0));
}

describe('patients roster — no pagination', () => {
  it('renders all seeded patients at once', async () => {
    await mountPatients();
    await waitFor(() => expect(archiveBtns().length).toBe(4));
    expect(document.querySelector('[aria-label="ניווט בין עמודים"]')).toBeNull();
  });
});
