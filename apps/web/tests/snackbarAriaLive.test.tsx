// The toast's live-region politeness must match its urgency: errors/warnings
// interrupt (role="alert"/assertive), while routine success/info toasts announce
// politely (role="status"/aria-live="polite") so they don't cut off whatever the
// screen reader is mid-sentence on.
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider, useApp } from '../src/store/AppStore';
import Snackbar from '../src/components/layout/Snackbar';

function Harness({ msg, type }: { msg: string; type: string }) {
  const { toast } = useApp();
  useEffect(() => { toast(msg, type); }, [msg, type, toast]);
  return <Snackbar />;
}
const show = (type: string) =>
  render(<AppStoreProvider><Harness msg="הודעה" type={type} /></AppStoreProvider>);

afterEach(cleanup);

describe('Snackbar — aria-live politeness by toast type', () => {
  it('announces success politely (role="status", aria-live="polite")', async () => {
    show('success');
    const el = await waitFor(() => document.querySelector('[aria-live]') as HTMLElement);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('interrupts for errors (role="alert", aria-live="assertive")', async () => {
    show('error');
    const el = await waitFor(() => document.querySelector('[aria-live]') as HTMLElement);
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });
});
