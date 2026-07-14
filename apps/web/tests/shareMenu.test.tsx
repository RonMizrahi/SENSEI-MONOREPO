// ShareMenu — the accessible menu-button that adds WhatsApp/Email sharing to existing
// flows. Unit-level URL building and no-PII/sanitization are covered by share.test.ts;
// here we exercise what the component adds: it stays closed until asked, opens into a
// real ARIA menu with both channels, moves focus to the first option and returns it to
// the trigger on Escape, disables itself when there is nothing to share, surfaces the
// sensitive-content warning when a note is passed, and opens WhatsApp via a safe
// (noopener) new window with the sanitized text URL-encoded — never raw. Post-action
// state is polled with waitFor so the file is deterministic under parallel load.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import ShareMenu from '../src/components/shared/ShareMenu';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

function mount(props: Partial<React.ComponentProps<typeof ShareMenu>> = {}) {
  return render(
    <AppStoreProvider>
      <ShareMenu subject="מכתב קליני · דנה לוי" text={'שורה 1\nשורה 2'} {...props} />
    </AppStoreProvider>,
  );
}
const trigger = () => document.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
const menu = () => document.querySelector('[role="menu"]') as HTMLElement | null;
const items = () => Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLButtonElement[];

describe('ShareMenu — accessible share affordance', () => {
  it('renders a single collapsed menu-button (no duplicate share buttons)', () => {
    mount();
    expect(document.querySelectorAll('button[aria-haspopup="menu"]').length).toBe(1);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(menu()).toBeNull();
  });

  it('opens into an ARIA menu offering WhatsApp and Email, focus on the first option', async () => {
    mount();
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()).toBeTruthy());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const labels = items().map((b) => b.textContent?.trim());
    expect(labels.some((t) => t?.includes('WhatsApp'))).toBe(true);
    expect(labels.some((t) => t?.includes('אימייל'))).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(items()[0]));
  });

  it('opens on ArrowDown from the trigger, focus on the first option', async () => {
    mount();
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    await waitFor(() => expect(menu()).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(items()[0]));
  });

  it('ArrowDown / ArrowUp rove between options and wrap around (roving focus)', async () => {
    mount();
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()).toBeTruthy());
    const [wa, email] = items();
    expect(document.activeElement).toBe(wa);
    fireEvent.keyDown(menu()!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(email);
    fireEvent.keyDown(menu()!, { key: 'ArrowDown' }); // wraps to first
    expect(document.activeElement).toBe(wa);
    fireEvent.keyDown(menu()!, { key: 'ArrowUp' });   // wraps to last
    expect(document.activeElement).toBe(email);
  });

  it('Home / End jump to the first / last option', async () => {
    mount();
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()).toBeTruthy());
    const [wa, email] = items();
    fireEvent.keyDown(menu()!, { key: 'End' });
    expect(document.activeElement).toBe(email);
    fireEvent.keyDown(menu()!, { key: 'Home' });
    expect(document.activeElement).toBe(wa);
  });

  it('Tab closes the menu (leaves the menu context)', async () => {
    mount();
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()).toBeTruthy());
    fireEvent.keyDown(menu()!, { key: 'Tab' });
    await waitFor(() => expect(menu()).toBeNull());
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    mount();
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()).toBeTruthy());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(menu()).toBeNull());
    expect(document.activeElement).toBe(trigger());
  });

  it('is disabled when there is nothing to share (empty / whitespace text)', () => {
    mount({ text: '   \n\t ' });
    expect(trigger().disabled).toBe(true);
  });

  it('shows the sensitive-content warning when a note is provided', async () => {
    const note = 'המכתב כולל פרטי מטופל. שתפו רק עם נמען מורשה.';
    mount({ note });
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()?.textContent).toContain(note));
  });

  it('shows no warning banner when no note is provided', async () => {
    mount({ text: 'content' });
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()).toBeTruthy());
    expect(menu()?.textContent).not.toContain('פרטי מטופל');
  });

  it('opens WhatsApp in a safe new window with the sanitized text URL-encoded, not raw', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    mount({ text: 'שלום world\nline2' });
    fireEvent.click(trigger());
    await waitFor(() => expect(menu()).toBeTruthy());
    const wa = items().find((b) => b.textContent?.includes('WhatsApp'))!;
    fireEvent.click(wa);
    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0];
    expect(String(url).startsWith('https://wa.me/?text=')).toBe(true);
    expect(target).toBe('_blank');
    expect(features).toContain('noopener'); // no tabnabbing
    expect(String(url)).toContain('%0A'); // newline encoded, not a raw break
    expect(decodeURIComponent(String(url).split('text=')[1])).toBe('שלום world\nline2');
  });
});
