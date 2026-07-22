// UX audit — Tier 2: never show an arbitrary patient's history, actionable
// dead-ends, and a route-aware main-landmark label for screen readers.
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

describe('meeting history — no arbitrary patient', () => {
  it('shows an all-patients directory (not patients[0]) when none is selected', async () => {
    mount({ view: 'app', route: 'meetingHistory', patientId: null });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('בחרו מטופל כדי לצפות'));
    // a searchable directory of patient rows, not an arbitrary patient's history
    expect(document.querySelector('[aria-label="חיפוש מטופל"]'), 'a search field is offered').toBeTruthy();
    expect(document.querySelector('.mh-dir-row'), 'clickable patient rows').toBeTruthy();
  });

  it('shows the chosen patient history when one is selected', async () => {
    mount({ view: 'app', route: 'meetingHistory', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('דנה לוי'));
    expect(document.body.textContent).not.toContain('בחרו מטופל כדי לצפות');
  });
});

describe('actionable dead-ends', () => {
  it('search "no results" offers a create-patient recovery action', async () => {
    mount({ view: 'app', route: 'search' });
    await settle();
    const input = document.querySelector('.search-main-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'zzzzנעלמתמופלxxx' } });
    await waitFor(() => expect(document.body.textContent).toContain('לא נמצאו תוצאות'));
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('מטופל חדש'))).toBe(true);
  });
});

describe('a11y — route-aware main landmark', () => {
  it('labels #main-content with the current route title', async () => {
    mount({ view: 'app', route: 'patients' });
    await settle();
    await waitFor(() => {
      const main = document.getElementById('main-content');
      expect(main?.getAttribute('aria-label')).toContain('מטופלים');
    });
  });
});
