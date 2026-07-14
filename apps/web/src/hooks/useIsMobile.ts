// Viewport gate: true on phone-width screens, where the app renders the
// dedicated mobile experience (src/components/mobile/*) instead of the desktop
// AppShell. Mirrors the store's matchMedia pattern (AppStore.tsx) — no dependency.
// 767px keeps tablets (iPad portrait ≥ 768) on the desktop shell, which already
// collapses its sidebar into a drawer down to 860px.
import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';

function queryMatches(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(queryMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange(); // sync in case the viewport changed between render and effect
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
    };
  }, []);

  return isMobile;
}
