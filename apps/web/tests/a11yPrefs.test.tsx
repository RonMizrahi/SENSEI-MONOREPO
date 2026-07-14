// Accessibility preferences — the user a11y controls (Settings) apply to the document
// root as data-a11y-* attributes + a text-size zoom, which the token layer keys off for
// high-contrast, reduced-motion, strong-focus, spacious-reading and underlined-links.
// A real WCAG-relevant feature; these lock the store's appliers (setA11y / resetA11y).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AppStoreProvider, useApp } from '../src/store/AppStore';

let api: any;
function Probe() { api = useApp(); return null; }
function mountStore() { render(<AppStoreProvider><Probe /></AppStoreProvider>); }

const html = () => document.documentElement as HTMLElement;
const attr = (k: string) => html().getAttribute('data-a11y-' + k);
const zoom = () => (html().style as any).zoom;

afterEach(() => {
  cleanup(); localStorage.clear()
  // clear the document-level side effects so tests don't bleed into each other
  ;['contrast', 'motion', 'focus', 'reading', 'underline'].forEach((k) => html().removeAttribute('data-a11y-' + k))
  ;(html().style as any).zoom = '';
});

describe('store — accessibility preferences apply to <html>', () => {
  beforeEach(mountStore);

  it('applies safe defaults on mount', () => {
    expect(attr('contrast')).toBe('normal');
    expect(attr('motion')).toBe('normal');
    expect(attr('focus')).toBe('normal');
    expect(attr('reading')).toBe('default');
    expect(attr('underline')).toBe('off');
  });

  it('each preference toggles its own data-attribute', () => {
    act(() => api.setA11y({ contrast: 'high', reduceMotion: true, strongFocus: true, reading: 'spacious', underlineLinks: true }));
    expect(attr('contrast')).toBe('high');
    expect(attr('motion')).toBe('reduce');
    expect(attr('focus')).toBe('strong');
    expect(attr('reading')).toBe('spacious');
    expect(attr('underline')).toBe('on');
  });

  it('text size maps to a document zoom', () => {
    act(() => api.setA11y({ textSize: 'large' }));
    expect(zoom()).toBe('1.15');
    act(() => api.setA11y({ textSize: 'small' }));
    expect(zoom()).toBe('0.9');
  });

  it('resetA11y restores every preference to its default', () => {
    act(() => api.setA11y({ contrast: 'high', reduceMotion: true, textSize: 'xlarge', underlineLinks: true }));
    expect(attr('contrast')).toBe('high');
    expect(zoom()).toBe('1.3');
    act(() => api.resetA11y());
    expect(attr('contrast')).toBe('normal');
    expect(attr('motion')).toBe('normal');
    expect(attr('underline')).toBe('off');
    expect(zoom()).toBe('1');
  });
});
