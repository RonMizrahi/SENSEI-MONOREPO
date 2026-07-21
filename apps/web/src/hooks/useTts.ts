// Text-to-speech via the Web Speech API (a browser built-in — no dependency,
// no backend). Speaks Hebrew UI content aloud for the "audio recap" affordances.
// Degrades gracefully: `supported` is false when the API is absent (older or
// embedded browsers, jsdom), so callers hide the control instead of offering a
// dead button. Any in-flight speech is cancelled on unmount.
import { useCallback, useEffect, useRef, useState } from 'react';

interface TtsController {
  supported: boolean
  speaking: boolean
  speak: (text: string) => void
  stop: () => void
  toggle: (text: string) => void
}

export function useTts(): TtsController {
  const supported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';
  const [speaking, setSpeaking] = useState(false);
  const supportedRef = useRef(supported);
  supportedRef.current = supported;

  const stop = useCallback(() => {
    if (!supportedRef.current) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!supportedRef.current || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, []);

  const toggle = useCallback((text: string) => {
    if (speaking) stop();
    else speak(text);
  }, [speaking, speak, stop]);

  // Stop any speech when the consuming component unmounts.
  useEffect(() => () => { if (supportedRef.current) window.speechSynthesis?.cancel(); }, []);

  return { supported, speaking, speak, stop, toggle };
}
