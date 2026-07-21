// Shared Highlight renderer: wraps the matched substring in <mark>, leaves the
// rest plain, and is a no-op when the query is empty or absent — consistent
// with the global search's hlParts SSOT.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import Highlight from '../src/components/shared/Highlight';

afterEach(cleanup);

describe('Highlight', () => {
  it('marks the matched substring only', () => {
    const { container } = render(<Highlight text="דנה לוי" query="דנה" />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('דנה');
    expect(container.textContent).toBe('דנה לוי');
  });

  it('renders plain text with no <mark> when the query is empty', () => {
    const { container } = render(<Highlight text="דנה לוי" query="" />);
    expect(container.querySelectorAll('mark').length).toBe(0);
    expect(container.textContent).toBe('דנה לוי');
  });

  it('renders plain text when the query does not occur', () => {
    const { container } = render(<Highlight text="דנה לוי" query="xyz" />);
    expect(container.querySelectorAll('mark').length).toBe(0);
    expect(container.textContent).toBe('דנה לוי');
  });
});
