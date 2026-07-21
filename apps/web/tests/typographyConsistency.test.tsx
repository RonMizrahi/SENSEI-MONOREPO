// Design-system guard: ONE page-title style. An audit found the dashboard
// greeting and the patient-file name at 24px/800 while the other eight screens
// used 27px/900 — two "page h1" styles for one role. This pins the canonical
// scale (DESIGN_SYSTEM.md §1) so a new screen can't quietly introduce a third.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
const settle = (ms = 150) => act(() => new Promise((r) => setTimeout(r, ms)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

const ROUTES: Array<Record<string, any>> = [
  { route: 'dashboard' },
  { route: 'patients' },
  { route: 'patient', patientId: 'p5' },
  { route: 'meetingHistory', patientId: null },
  { route: 'patientArchive' },
  { route: 'settings' },
  { route: 'upload' },
];

describe('typography — one page-title style everywhere', () => {
  for (const r of ROUTES) {
    it(`h1 on "${r.route}" is 27px/900`, async () => {
      localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', onboardTipDismissed: true, ...r }));
      render(<AppStoreProvider><App /></AppStoreProvider>);
      await settle();
      const h1 = await waitFor(() => {
        const el = document.querySelector('#main-content h1') as HTMLElement;
        expect(el, 'page renders an h1').toBeTruthy();
        return el;
      }, { timeout: 3000 });
      const cs = getComputedStyle(h1);
      expect(cs.fontSize, 'title size').toBe('27px');
      expect(cs.fontWeight, 'title weight').toBe('900');
    });
  }
});
