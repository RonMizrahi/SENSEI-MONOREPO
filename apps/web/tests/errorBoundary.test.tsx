// Verifies the page-level error boundary: a throwing screen renders the
// recoverable fallback (role="alert") instead of white-screening, and a
// resetKey change (navigation) clears the error.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ErrorBoundary from '../src/components/shared/ErrorBoundary';

function Boom(): JSX.Element { throw new Error('boom'); }
function Fine() { return <div>ok content</div>; }

afterEach(() => { cleanup(); sessionStorage.clear(); });

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

  it('a stale-chunk error auto-reloads ONCE (bounded), then falls back to the manual card', () => {
    // Deploy-while-active: first stale-chunk catch reloads automatically (fresh
    // HTML → current hashes; work is flushed to localStorage on pagehide). The
    // sessionStorage flag bounds it to a single retry — a second stale error in
    // the same tab (broken deploy) must NOT reload again (no loop), only offer
    // the manual recovery card.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    function StaleChunk(): JSX.Element { throw new Error('Failed to fetch dynamically imported module: /assets/Page-OLD1.js'); }
    const reload = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, 'location', { value: { ...orig, reload }, writable: true });
    try {
      render(<ErrorBoundary resetKey="a"><StaleChunk /></ErrorBoundary>);
      expect(reload, 'first mismatch → one automatic reload').toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem('sensei_stale_reload_once')).toBe('1');
      cleanup();
      render(<ErrorBoundary resetKey="a"><StaleChunk /></ErrorBoundary>);
      expect(reload, 'second mismatch in the same tab → NO further auto-reload').toHaveBeenCalledTimes(1);
      expect(screen.getByText('גרסה חדשה של סנסיי זמינה'), 'manual recovery card offered instead').toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'location', { value: orig, writable: true });
      err.mockRestore(); info.mockRestore();
    }
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
