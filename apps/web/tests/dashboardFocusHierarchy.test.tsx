// Dashboard progressive-disclosure contract: the home shows only relevant,
// actionable content by default.
//   1. The onboarding tip auto-hides once the core flow succeeded (hasUploaded)
//      — after a first upload it is no longer guidance.
//   2. Side-panel priority order: today's agenda (actions) → mini month (nav)
//      → Google-Calendar stub (roadmap) → category legend last.
//   3. The legend is a <details> collapsed by default — secondary decoding aid
//      (every event block prints its own category label), not primary info.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

describe('dashboard — focused control-center hierarchy', () => {
  it('the onboarding tip hides automatically after a first successful upload', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: false, hasUploaded: true });
    await settle();
    expect(document.body.textContent).not.toContain('ברוכים הבאים לסנסיי');
  });

  it('the onboarding tip still shows for a fresh account (not dismissed, nothing uploaded)', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: false, hasUploaded: false });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('ברוכים הבאים לסנסיי'));
  });

  it('side panel is ordered actions-first and the legend is collapsed by default', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true });
    await settle();
    await waitFor(() => expect(document.querySelector('.calh-side')).toBeTruthy());
    const side = document.querySelector('.calh-side')!;
    const kinds = [...side.children].map((el) => {
      const t = el.textContent || '';
      if (t.includes('הפגישות שלך היום')) return 'agenda';
      if (t.includes('Google Calendar')) return 'gcal';
      if (el.classList.contains('calh-legend')) return 'legend';
      return 'mini-month';
    });
    expect(kinds).toEqual(['agenda', 'mini-month', 'gcal', 'legend']);
    const legend = side.querySelector('details.calh-legend') as HTMLDetailsElement;
    expect(legend.open).toBe(false);
    // the summary control stays reachable and labelled
    expect(legend.querySelector('summary')?.textContent).toBe('סוגי פגישות');
  });
});
