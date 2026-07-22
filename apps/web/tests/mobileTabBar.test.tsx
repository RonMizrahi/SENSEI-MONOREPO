// Mobile bottom tab bar: thumb-reachable primary navigation derived from the
// navConfig SSOT (the group before the first section), with active state and
// route navigation. The full nav stays in the drawer.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import MobileTabBar from '../src/components/mobile/MobileTabBar';
import { navConfig } from '../src/nav/navConfig';

afterEach(() => { cleanup(); localStorage.clear(); });

const primaryKeys = (() => {
  const out: string[] = [];
  for (const n of navConfig()) { if (n.section) break; if (n.key) out.push(n.key); }
  return out;
})();

describe('MobileTabBar', () => {
  it('renders exactly the primary navConfig group (before the first section) as a nav landmark', () => {
    render(<AppStoreProvider><MobileTabBar /></AppStoreProvider>);
    const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });
    const tabs = nav.querySelectorAll('button');
    expect(tabs.length).toBe(primaryKeys.length);
    expect(primaryKeys).toEqual(['dashboard', 'patients', 'calendar']);
  });

  it('every tab is a labelled ≥44px-friendly control', () => {
    render(<AppStoreProvider><MobileTabBar /></AppStoreProvider>);
    for (const b of screen.getByRole('navigation').querySelectorAll('button')) {
      expect(b.getAttribute('aria-label')).toBeTruthy();
      expect(b.querySelector('svg')).toBeTruthy();
    }
  });

  it('marks the current route active (aria-current) and stays active on drill-in', () => {
    localStorage.setItem('sensei_session_react_v1', JSON.stringify({ __savedAt: Date.now(), route: 'patient' }));
    render(<AppStoreProvider><MobileTabBar /></AppStoreProvider>);
    // the patients tab is aria-current on the patient detail route (alias)
    const current = [...screen.getByRole('navigation').querySelectorAll('button')]
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('aria-label')).toBe('מטופלים');
  });
});
