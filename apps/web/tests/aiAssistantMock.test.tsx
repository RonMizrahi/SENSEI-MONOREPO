// Demo/offline mode: with no backend configured, the assistant keeps its original
// deterministic canned answers so the client-only build behaves exactly as before.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import AiAssistant from '../src/components/layout/AiAssistant';

afterEach(() => { cleanup(); localStorage.clear(); });

function mount() {
  return render(
    <AppStoreProvider>
      <AiAssistant />
    </AppStoreProvider>,
  );
}

describe('AiAssistant — demo mode (no backend)', () => {
  it('opens from the FAB and answers with the canned response', async () => {
    mount();

    fireEvent.click(document.querySelector('[aria-label="שאל את סנסיי"]') as HTMLElement);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();

    const input = document.querySelector('[aria-label="הקלדת שאלה"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'מי המטופלים בסיכון גבוה?' } });
    fireEvent.click(document.querySelector('[aria-label="שליחה"]') as HTMLElement);

    // The user's message shows immediately; the canned answer arrives after the delay.
    await waitFor(
      () => expect(document.body.textContent).toContain('שלושה מטופלים מסומנים בסיכון גבוה'),
      { timeout: 2000 },
    );
  });

  it('clicking a suggestion chip sends that exact question', async () => {
    mount();
    fireEvent.click(document.querySelector('[aria-label="שאל את סנסיי"]') as HTMLElement);

    const chip = [...document.querySelectorAll('.shell-ai-chip')].find(
      (el) => el.textContent === 'מתי נפגשתי לאחרונה עם סימבה?',
    );
    expect(chip).toBeTruthy();
    fireEvent.click(chip as HTMLElement);

    // The chip's exact question is sent as the user's message.
    await waitFor(() =>
      expect(document.body.textContent).toContain('מתי נפגשתי לאחרונה עם סימבה?'),
    );
    // And the mock's canned answer follows (Simba isn't a keyed name → default reply).
    await waitFor(
      () => expect(document.body.textContent).toContain('על סמך הסיכומים שנותחו'),
      { timeout: 2000 },
    );
  });
});
