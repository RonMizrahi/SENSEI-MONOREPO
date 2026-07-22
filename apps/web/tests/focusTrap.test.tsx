// Regression tests for the modal focus-trap hook: Tab/Shift+Tab must cycle
// within the overlay (not escape to the background), and focus must return to
// the trigger when the overlay closes.
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useFocusTrap } from '../src/hooks/useFocusTrap';

function Harness() {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap<HTMLDivElement>(open);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>open</button>
      <button data-testid="background">background control</button>
      {open && (
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="t"
          aria-describedby="d"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        >
          <h2 id="t">title</h2>
          <p id="d">desc</p>
          <button data-testid="first">first</button>
          <button data-testid="mid">mid</button>
          <button data-testid="last" onClick={() => setOpen(false)}>close</button>
        </div>
      )}
    </div>
  );
}

afterEach(cleanup);

describe('useFocusTrap', () => {
  it('moves focus into the overlay when it opens', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger'));
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('Tab on the last element wraps to the first (does not escape)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger'));
    screen.getByTestId('last').focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('Shift+Tab on the first element wraps to the last', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger'));
    screen.getByTestId('first').focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last'));
  });

  it('restores focus to the trigger when the overlay closes', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    // close via the inner button
    fireEvent.click(screen.getByTestId('last'));
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape closes a labelled modal dialog and returns focus to the trigger', () => {
    // Mirrors the upload conflict modal wiring: ref-trapped dialog with
    // aria-labelledby/aria-describedby and an Escape handler.
    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
    expect(dialog.getAttribute('aria-describedby')).toBe('d');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
