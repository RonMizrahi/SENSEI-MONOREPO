// useIsMobile — viewport gate that switches the app between the desktop shell
// and the dedicated mobile experience. Verifies initial match, live response to
// a viewport change, and listener cleanup.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useIsMobile, MOBILE_QUERY } from '../src/hooks/useIsMobile';

type Listener = () => void;

/** Install a controllable matchMedia; returns a setter that flips matches + notifies. */
function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const removed: Listener[] = [];
  const mql = {
    get matches() { return matches; },
    media: MOBILE_QUERY,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => { listeners.delete(cb); removed.push(cb); },
  };
  window.matchMedia = ((q: string) => { mql.media = q; return mql; }) as any;
  return {
    set(next: boolean) { matches = next; listeners.forEach((l) => l()); },
    listenerCount: () => listeners.size,
    removedCount: () => removed.length,
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useIsMobile', () => {
  it('reflects the initial matchMedia result', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('is false on wide viewports', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates when the viewport crosses the breakpoint', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => mm.set(true));
    expect(result.current).toBe(true);
    act(() => mm.set(false));
    expect(result.current).toBe(false);
  });

  it('removes its listener on unmount', () => {
    const mm = installMatchMedia(true);
    const { unmount } = renderHook(() => useIsMobile());
    expect(mm.listenerCount()).toBe(1);
    unmount();
    expect(mm.listenerCount()).toBe(0);
    expect(mm.removedCount()).toBe(1);
  });
});
