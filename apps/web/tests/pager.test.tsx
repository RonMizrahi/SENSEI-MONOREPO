// Store logic — the pagination view-model (`useApp().pager`) and the pure
// `resolveTheme` helper. `pager` drives the patients / sessions / documents
// tables: page slicing, range labels, prev/next disabled state, and the
// page-number sequence with ellipses. It was the lowest-covered logic in the
// store (a real algorithm behind three tables); these lock its behavior.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AppStoreProvider, useApp, resolveTheme } from '../src/store/AppStore';

// Capture the live context value so tests can call set()/pager() directly.
let api: any;
function Probe() { api = useApp(); return null; }
function mountStore() { render(<AppStoreProvider><Probe /></AppStoreProvider>); }
const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

afterEach(() => { cleanup(); localStorage.clear(); });

describe('store — resolveTheme (pure)', () => {
  it('maps explicit prefs and resolves system to a concrete theme', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(['light', 'dark']).toContain(resolveTheme('system'));
    expect(['light', 'dark']).toContain(resolveTheme('anything-unknown'));
  });
});

describe('store — pager() view-model', () => {
  beforeEach(mountStore);

  it('slices to the current page + size and labels the range', () => {
    act(() => { api.set({ pPage: 2, pSize: 6 }); });
    const { slice, view } = api.pager(items(20), 'pPage', 'pSize');
    expect(slice).toEqual([7, 8, 9, 10, 11, 12]);
    expect(view.current).toBe(2);
    expect(view.totalPages).toBe(4); // ceil(20 / 6)
    expect(view.rangeLabel).toBe('מציג 7–12 מתוך 20');
    expect(view.show).toBe(true); // 20 > 6
  });

  it('clamps an out-of-range current page to the last page', () => {
    act(() => { api.set({ cPage: 99, cSize: 6 }); });
    const { slice, view } = api.pager(items(20), 'cPage', 'cSize');
    expect(view.current).toBe(4);
    expect(view.nextDisabled).toBe(true);
    expect(view.prevDisabled).toBe(false);
    expect(slice).toEqual([19, 20]);
  });

  it('hides the pager and disables prev on the first page of a small set', () => {
    expect(api.pager(items(6), 'sPage', 'sSize').view.show).toBe(false); // 6 items → hidden
    expect(api.pager(items(5), 'tPage', 'tSize', { sizes: [5, 10, 20], showAbove: 5 }).view.show).toBe(false);
    expect(api.pager(items(6), 'uPage', 'uSize', { sizes: [5, 10, 20], showAbove: 5 }).view.show).toBe(true);
    act(() => { api.set({ fPage: 1, fSize: 6 }); });
    const { view } = api.pager(items(20), 'fPage', 'fSize');
    expect(view.prevDisabled).toBe(true);
    expect(view.nextDisabled).toBe(false);
  });

  it('lists every page (no ellipsis) when there are 7 or fewer pages', () => {
    act(() => { api.set({ aPage: 1, aSize: 6 }); });
    const { view } = api.pager(items(42), 'aPage', 'aSize'); // exactly 7 pages
    expect(view.pageItems.map((p: any) => (p.gap ? '…' : p.n))).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('collapses the middle with ellipses when there are many pages', () => {
    act(() => { api.set({ mPage: 10, mSize: 6 }); });
    const { view } = api.pager(items(120), 'mPage', 'mSize'); // 20 pages, current 10
    const labels = view.pageItems.map((p: any) => (p.gap ? '…' : p.n));
    expect(labels[0]).toBe('1'); // first page always shown
    expect(labels[labels.length - 1]).toBe('20'); // last page always shown
    expect(labels).toContain('10'); // current page shown
    expect(labels.filter((l: string) => l === '…').length).toBe(2); // a gap on each side
  });
});
