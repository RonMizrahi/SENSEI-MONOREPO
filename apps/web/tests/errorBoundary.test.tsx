// Verifies the page-level error boundary: a throwing screen renders the
// recoverable fallback (role="alert") instead of white-screening, and a
// resetKey change (navigation) clears the error.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ErrorBoundary from '../src/components/shared/ErrorBoundary';

function Boom(): JSX.Element { throw new Error('boom'); }
function Fine() { return <div>ok content</div>; }

afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('renders a recoverable alert instead of crashing when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary resetKey="a"><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('משהו השתבש במסך הזה')).toBeInTheDocument();
    // observability: the caught error is logged (not swallowed silently)
    expect(spy).toHaveBeenCalledWith('[ErrorBoundary] render error on route:', 'a', expect.any(Error), expect.anything());
    spy.mockRestore();
  });

  it('recovers (clears the error) when resetKey changes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<ErrorBoundary resetKey="a"><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<ErrorBoundary resetKey="b"><Fine /></ErrorBoundary>);
    expect(screen.getByText('ok content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('passes children through unchanged when there is no error', () => {
    render(<ErrorBoundary resetKey="a"><Fine /></ErrorBoundary>);
    expect(screen.getByText('ok content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a stale-chunk error (post-deploy) offers a reload, not a dead-end navigation', () => {
    // After a deploy, a lazy route import fails because the old chunk hash is
    // gone. Navigating home can't fix that — only a reload (fresh HTML → fresh
    // hashes) can, and app state survives it via localStorage persistence.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function StaleChunk(): JSX.Element { throw new Error('Failed to fetch dynamically imported module: /assets/TasksPage-OLD123.js'); }
    const reload = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, 'location', { value: { ...orig, reload }, writable: true });
    try {
      render(<ErrorBoundary resetKey="a"><StaleChunk /></ErrorBoundary>);
      expect(screen.getByText('גרסה חדשה של סנסיי זמינה')).toBeInTheDocument();
      screen.getByText('רענון לגרסה העדכנית').click();
      expect(reload).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { value: orig, writable: true });
      spy.mockRestore();
    }
  });
});
