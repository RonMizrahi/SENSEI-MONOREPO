// Accessibility (axe) for the dedicated mobile experience — the desktop a11y
// suite audits routes in the desktop shell, so the mobile screens need their own
// pass. matchMedia is mocked to the phone breakpoint. Same convention as
// a11y.test.tsx: color-contrast is disabled (jsdom has no layout) — contrast is
// covered by the token system + tests/contrast.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { MOBILE_QUERY } from '../src/hooks/useIsMobile';

declare module 'vitest' {
  interface Assertion<T = any> { toHaveNoViolations(): T }
  interface AsymmetricMatchersContaining { toHaveNoViolations(): void }
}
expect.extend(matchers);

const PKEY = 'sensei_session_react_v1';
const AXE_OPTS = { rules: { 'color-contrast': { enabled: false } } };

function setMobile() {
  window.matchMedia = ((q: string) => ({
    matches: q === MOBILE_QUERY, media: q,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as any;
}
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 60)));

beforeEach(() => setMobile());
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('accessibility (axe) — mobile experience', () => {
  it('day view (with an expanded appointment + open sheet)', async () => {
    const { container } = mount({ route: 'dashboard' });
    await waitFor(() => expect(container.querySelectorAll('.mob-day-btn').length).toBe(14));
    fireEvent.click(container.querySelectorAll('.mob-day-btn')[1] as HTMLElement); // Monday → has events
    await waitFor(() => expect(container.querySelector('.mob-appt')).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(container.querySelector('.mob-plus') as HTMLElement);
    await waitFor(() => expect(container.querySelector('.mob-actions')).toBeTruthy());
    fireEvent.click(container.querySelector('.mob-actions .mob-action-btn') as HTMLElement); // insight sheet
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    await settle();
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  }, 15000);

  it('prep report', async () => {
    const { container } = mount({ route: 'report', patientId: 'p3' });
    await waitFor(() => expect(container.querySelector('.mob-screen')).toBeTruthy());
    await settle();
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  }, 15000);

  it('patient profile', async () => {
    const { container } = mount({ route: 'patient', patientId: 'p1' });
    await waitFor(() => expect(container.querySelector('.mob-screen')).toBeTruthy());
    await settle();
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  }, 15000);
});
