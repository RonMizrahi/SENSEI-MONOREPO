// The shared blue Checkbox is the single source of truth for checkboxes. Guards
// its contract: native checkbox semantics, the .ds-checkbox design-system class,
// onChange wiring, and imperative indeterminate. The blue styling itself is CSS
// (global.css .ds-checkbox) — asserted present so it can't be dropped.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import Checkbox from '../src/components/shared/Checkbox';

afterEach(cleanup);

describe('shared Checkbox (SSOT)', () => {
  it('renders a native checkbox with the .ds-checkbox class and fires onChange', () => {
    const fn = vi.fn();
    const { container } = render(<Checkbox checked={false} onChange={fn} aria-label="x" />);
    const cb = container.querySelector('input.ds-checkbox') as HTMLInputElement;
    expect(cb).toBeTruthy();
    expect(cb.type).toBe('checkbox');
    fireEvent.click(cb);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('merges a caller className and forwards native props', () => {
    const { container } = render(<Checkbox className="mine" checked readOnly aria-label="x" />);
    const cb = container.querySelector('input') as HTMLInputElement;
    expect(cb.className).toBe('ds-checkbox mine');
    expect(cb.checked).toBe(true);
  });

  it('applies indeterminate as a DOM property (no HTML attribute exists for it)', () => {
    const { container } = render(<Checkbox indeterminate checked={false} readOnly aria-label="x" />);
    expect((container.querySelector('input') as HTMLInputElement).indeterminate).toBe(true);
  });

  it('ships blue design-system styling for every state', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles', 'global.css'), 'utf8');
    expect(css).toMatch(/\.ds-checkbox\s*\{[^}]*border:\s*1\.5px solid var\(--primary-border\)/);
    expect(css).toMatch(/\.ds-checkbox:checked\s*\{[^}]*var\(--primary\)/);
    expect(css).toMatch(/\.ds-checkbox:indeterminate/);
    expect(css).toMatch(/\.ds-checkbox:focus-visible/);
    expect(css).toMatch(/\.ds-checkbox:disabled/);
  });
});
