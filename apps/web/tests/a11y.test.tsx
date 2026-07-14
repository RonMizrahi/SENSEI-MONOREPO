// Automated accessibility regression tests (axe-core via jsdom).
// jsdom can't evaluate visual rules (color-contrast needs real layout), so those
// are disabled here — contrast is covered by the token system + manual review.
// This catches the structural WCAG issues that regress silently: invalid ARIA,
// unlabeled controls, missing alt text, duplicate ids, list/landmark structure,
// and nested interactive controls.
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { ALL_ROUTES } from '../src/nav/navConfig';

// vitest-axe ships its type augmentation against the legacy `Vi` global namespace;
// vitest 2.x augments the `vitest` module instead — declare it here.
declare module 'vitest' {
  interface Assertion<T = any> { toHaveNoViolations(): T }
  interface AsymmetricMatchersContaining { toHaveNoViolations(): void }
}

expect.extend(matchers);

const PKEY = 'sensei_session_react_v1';
const AXE_OPTS = { rules: { 'color-contrast': { enabled: false } } };

function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(
    <AppStoreProvider>
      <App />
    </AppStoreProvider>,
  );
}

// Let the async a11y-promotion MutationObserver run before auditing, so axe sees
// the same promoted DOM a real user's assistive tech would.
const settle = () => act(() => new Promise((r) => setTimeout(r, 60)));

afterEach(() => { cleanup(); localStorage.clear(); });

describe('accessibility (axe) — every content route, no structural violations', () => {
  it('auth / login', async () => {
    const { container } = mount({ view: 'auth', authScreen: 'login' });
    await waitFor(() => expect(container.querySelector('h1')?.textContent?.trim()).toBeTruthy());
    await settle();
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  }, 15000);

  for (const route of ALL_ROUTES) {
    it(route, async () => {
      const { container } = mount({ view: 'app', route });
      // Wait past the Suspense skeleton (no h1) for the real screen heading.
      await waitFor(() => expect(container.querySelector('h1')?.textContent?.trim()).toBeTruthy());
      await settle();
      expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
    }, 15000);
  }
});

describe('accessibility (axe) — interactive overlays', () => {
  it('command palette (⌘K)', async () => {
    const { container } = mount({ view: 'app', route: 'dashboard' });
    await waitFor(() => expect(container.querySelector('h1')?.textContent?.trim()).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(document.querySelector('[role="dialog"][aria-label="פלטת פקודות"]')).toBeTruthy());
    await settle();
    // audit the whole document — the palette portals to <body>, outside `container`
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  }, 15000);

  it('create-patient dialog', async () => {
    // `dialog` is transient (stripped on restore), so open it via a real click.
    mount({ view: 'app', route: 'patients' });
    await waitFor(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('מטופל חדש'));
      expect(btn).toBeTruthy();
    });
    const addBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('מטופל חדש'))!;
    fireEvent.click(addBtn);
    await waitFor(() => expect(document.querySelector('[role="dialog"][aria-modal="true"]')).toBeTruthy());
    await settle();
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  }, 15000);
});

// Keyboard operability of the command palette (WCAG 2.1.1).
describe('keyboard — command palette combobox', () => {
  it('command palette (⌘K) exposes the active option via aria-activedescendant', async () => {
    mount({ view: 'app', route: 'patients' });
    await settle();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await settle();
    const dlg = document.querySelector('[role="dialog"][aria-label="פלטת פקודות"]');
    expect(dlg, '⌘/Ctrl+K should open the command palette').toBeTruthy();
    const input = dlg!.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('role')).toBe('combobox');
    fireEvent.input(input, { target: { value: 'מ' } });
    await settle();
    expect(dlg!.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
    const active1 = input.getAttribute('aria-activedescendant');
    expect(active1, 'an option should be active').toBeTruthy();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const active2 = input.getAttribute('aria-activedescendant');
    expect(active2).toBeTruthy();
    expect(active2).not.toBe(active1); // ArrowDown moved the active option
    expect(document.getElementById(active2!)?.getAttribute('aria-selected')).toBe('true');
  }, 15000);

  it('dashboard week-view controls are keyboard-operable (WCAG 2.1.1)', async () => {
    // The home is a Google-Calendar-style week view. Every interaction (today,
    // week nav, view segments, new-meeting, mini-month days, event blocks) is
    // authored as a native <button>, so all controls are keyboard-reachable
    // without relying on the pointer-target promotion engine. These toolbar and
    // side-panel controls render synchronously (no dependency on async event
    // loading), so assert their semantics directly.
    const { container } = mount({ view: 'app', route: 'dashboard' });
    await waitFor(() => expect(container.querySelector('h1')?.textContent?.trim()).toBeTruthy());
    await settle();
    expect(container.querySelector('.calh-today-btn')?.tagName, 'today button is native').toBe('BUTTON');
    expect(container.querySelector('.calh-new-btn')?.tagName, 'new-meeting CTA is native').toBe('BUTTON');
    const miniDay = container.querySelector('.calh-mini-day') as HTMLElement;
    expect(miniDay, 'mini-month renders day cells').toBeTruthy();
    expect(miniDay.tagName, 'mini-month day is a native button').toBe('BUTTON');
    // native buttons must not be double-promoted with a redundant role
    expect(miniDay.hasAttribute('role')).toBe(false);
  }, 15000);

  it('AI assistant focuses its message input when opened', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    const fab = [...document.querySelectorAll('[role="button"],button')]
      .find((e) => /שאל את סנסיי/.test(e.getAttribute('aria-label') || '')) as HTMLElement;
    expect(fab, 'AI assistant FAB should render').toBeTruthy();
    fireEvent.click(fab);
    await settle();
    const panel = document.querySelector('[role="dialog"][aria-label="שאל את סנסיי"]');
    expect(panel, 'clicking the FAB opens the AI panel').toBeTruthy();
    const input = panel!.querySelector('input');
    expect(document.activeElement, 'the message input is focused on open').toBe(input);
  }, 15000);
});
