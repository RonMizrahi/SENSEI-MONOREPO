// Demo-only affordances must not leak into a real (non-demo) production session.
// The upload page carries a "demo a format error" link used to showcase the error
// state in the design reference; it is gated behind demoMode so real users never
// see it. This guards that gate (both directions).
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 60)));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('demo-only affordances are hidden in production', () => {
  it('upload "demo a format error" link shows in demo mode', async () => {
    const { container } = mount({ view: 'app', route: 'upload', demoMode: true });
    await settle();
    expect(container.querySelector('.upl-demo-link'), 'shown in demo mode (design reference)').toBeTruthy();
  });

  it('upload "demo a format error" link is hidden in a real session', async () => {
    const { container } = mount({ view: 'app', route: 'upload', demoMode: false });
    await settle();
    expect(container.querySelector('.upl-demo-link'), 'hidden when not in demo mode').toBeFalsy();
  });
});

describe('upload page — patient select is wired to a real value', () => {
  // Regression: the "choose patient for this upload" select had no value/onChange,
  // so the choice was silently discarded and the summary always used the globally
  // current patient. It now carries the patient id and drives the summary.
  it('options carry patient ids and selecting one updates the controlled value', async () => {
    const { container } = mount({ view: 'app', route: 'upload' });
    await settle();
    const sel = container.querySelector('select[aria-label="בחירת מטופל להעלאה"]') as HTMLSelectElement;
    expect(sel, 'the patient select renders').toBeTruthy();
    expect(sel.options.length).toBeGreaterThan(1);
    expect(sel.options[0].value, 'options use patient ids as values').toMatch(/^p\d+/);
    fireEvent.change(sel, { target: { value: 'p3' } });
    await settle();
    expect(sel.value, 'controlled value round-trips through the store').toBe('p3');
  });
});
