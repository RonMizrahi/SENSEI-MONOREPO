// useTts wraps the Web Speech API. It must degrade gracefully when the API is
// absent (jsdom / embedded browsers) and drive speechSynthesis when present.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTts } from '../src/hooks/useTts';

afterEach(() => {
  delete (window as any).speechSynthesis;
  delete (window as any).SpeechSynthesisUtterance;
});

describe('useTts', () => {
  it('reports unsupported when the Web Speech API is absent, and speak is a safe no-op', () => {
    const { result } = renderHook(() => useTts());
    expect(result.current.supported).toBe(false);
    act(() => result.current.speak('שלום'));
    expect(result.current.speaking).toBe(false);
  });

  it('drives speechSynthesis when supported, and stop cancels', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    (window as any).speechSynthesis = { speak, cancel };
    (window as any).SpeechSynthesisUtterance = class {
      lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(public text: string) {}
    };
    const { result } = renderHook(() => useTts());
    expect(result.current.supported).toBe(true);

    act(() => result.current.speak('סיכום היום'));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(result.current.speaking).toBe(true);

    act(() => result.current.stop());
    expect(cancel).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });

  it('ignores empty text', () => {
    const speak = vi.fn();
    (window as any).speechSynthesis = { speak, cancel: vi.fn() };
    (window as any).SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    const { result } = renderHook(() => useTts());
    act(() => result.current.speak('   '));
    expect(speak).not.toHaveBeenCalled();
  });
});
