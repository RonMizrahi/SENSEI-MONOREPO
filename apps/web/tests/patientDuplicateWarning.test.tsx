// R-2 regression — a SOFT, non-blocking duplicate warning on patient creation.
// If a new patient's phone or email matches an existing record, the form surfaces
// a warning, but it must NEVER block a legitimate save (shared family numbers /
// re-adds are valid). The check ignores formatting differences and, in edit mode,
// the record being edited itself.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); });

const warning = () => document.querySelector('[data-testid="dup-warning"]');
const byText = (t: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t)) as HTMLElement;
const field = (label: string) => document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;

// Open the create dialog through the UI so the dialog state is real (a pre-seeded
// `dialog:'create'` doesn't survive store hydration), then fill the form fields.
async function openCreate(values: { name?: string; phone?: string; email?: string }) {
  mount({ view: 'app', route: 'patients' });
  await settle();
  fireEvent.click(byText('מטופל חדש'));
  await waitFor(() => expect(field('שם מלא')).toBeTruthy());
  if (values.name != null) fireEvent.input(field('שם מלא'), { target: { value: values.name } });
  if (values.phone != null) fireEvent.input(field('טלפון'), { target: { value: values.phone } });
  if (values.email != null) fireEvent.input(field('דוא״ל'), { target: { value: values.email } });
  await settle();
}

describe('duplicate-patient warning on creation (R-2)', () => {
  it('warns when the phone matches an existing patient, ignoring formatting', async () => {
    // p1 = דנה לוי, phone 054-1234567. Enter the same digits without dashes.
    await openCreate({ name: 'לקוח חדש', phone: '0541234567' });
    await waitFor(() => expect(warning(), 'a matching phone raises the soft warning').toBeTruthy());
    expect(warning()!.textContent).toContain('דנה לוי');
  });

  it('warns when the email matches, case-insensitively', async () => {
    await openCreate({ name: 'לקוח חדש', email: 'DANA.L@MAIL.COM' });
    await waitFor(() => expect(warning()).toBeTruthy());
  });

  it('does NOT warn for a genuinely new patient', async () => {
    await openCreate({ name: 'לקוח חדש', phone: '050-0001111', email: 'brand.new@mail.com' });
    expect(warning(), 'no false positive for unique details').toBeFalsy();
  });

  it('is non-blocking — the patient can still be saved despite the warning', async () => {
    await openCreate({ name: 'תאום לגיטימי', phone: '0541234567' });
    await waitFor(() => expect(warning()).toBeTruthy());
    fireEvent.click(byText('יצירת מטופל'));
    await settle();
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(PKEY) || '{}');
      expect((stored.patients || []).some((p: any) => p.name === 'תאום לגיטימי'), 'save succeeds despite the warning').toBe(true);
    }, { timeout: 2000 });
  });
});
