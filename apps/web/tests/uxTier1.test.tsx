// UX audit — Tier 1 improvements: upload in the nav, the app-bar CTA routes
// through navigate() (deep-link/focus/title), the prep report carries a clinical
// disclaimer, and the home welcome tip guides + persists dismissal.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { navConfig } from '../src/nav/navConfig';
import { CLINICAL_DISCLAIMER } from '../src/components/shared/AiDisclaimer';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

describe('discoverability — upload reachable from content, not the side menu', () => {
  it('upload is NOT a nav destination (removed from the side menu by request)', () => {
    expect(navConfig().some((n) => n.key === 'upload')).toBe(false);
  });

  it('the home welcome-tip CTA routes through navigate() so the URL is deep-linkable', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: false });
    await settle();
    const cta = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('העלאת הקלטה')) as HTMLElement;
    expect(cta, 'an upload entry point must exist on the home page').toBeTruthy();
    fireEvent.click(cta);
    await waitFor(() => expect(window.location.hash).toBe('#/upload'));
  });
});

describe('trust — prep report clinical disclaimer', () => {
  it('renders the shared clinical disclaimer on the prep report', async () => {
    mount({ view: 'app', route: 'report', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain(CLINICAL_DISCLAIMER.slice(0, 24)));
  });
});

describe('onboarding — home welcome tip', () => {
  it('shows a dismissible welcome that guides to the core flow and persists dismissal', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('ברוכים הבאים לסנסיי'));
    fireEvent.click(document.querySelector('[aria-label="סגירת ההודעה"]') as HTMLElement);
    await waitFor(() => expect(document.body.textContent).not.toContain('ברוכים הבאים לסנסיי'));
    // persistence is debounced — poll until the flag is written
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(PKEY) || '{}');
      expect(stored.onboardTipDismissed).toBe(true);
    }, { timeout: 2000 });
  });

  it('does not show once dismissed', async () => {
    mount({ view: 'app', route: 'dashboard', onboardTipDismissed: true });
    await settle();
    expect(document.body.textContent).not.toContain('ברוכים הבאים לסנסיי');
  });
});
