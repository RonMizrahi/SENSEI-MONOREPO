// Page-level error boundary: a render error in one screen shows a recoverable
// card instead of white-screening the whole app. `resetKey` (the current route)
// clears the error when the user navigates elsewhere, so the app self-recovers.
import React from 'react';

interface Props { children: React.ReactNode; resetKey: string; onReset?: () => void }
interface State { error: Error | null }

// A dynamic-import failure after a deploy means this client's HTML references
// chunk hashes that no longer exist on the server (stale client). Navigation
// can't fix that — only a reload can (fresh HTML → current hashes). Detect it
// so the recovery UI offers the one action that works. Loop-safe: index.html is
// served with max-age=0/must-revalidate, so the reload always fetches current
// hashes; session-safe: app state persists to localStorage (debounced store).
export function isStaleChunkError(error: Error | null): boolean {
  return !!error && /dynamically imported module|Importing a module script failed|Loading chunk|error loading/i.test(String(error.message || error));
}

// One automatic recovery per tab session for a VERIFIED stale-chunk mismatch:
// reload once without asking (fresh HTML → current hashes; unsaved work is safe —
// the store flushes to localStorage on pagehide). The sessionStorage flag bounds
// it to a single retry: if the chunk still fails after that one reload (e.g. a
// broken deploy), we stop auto-reloading and show the manual recovery card
// instead of looping. The flag is per-tab (sessionStorage), so multi-tab clients
// each recover independently without coordinating reload storms.
const RELOAD_ONCE_KEY = 'sensei_stale_reload_once';
export function attemptStaleChunkReload(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_ONCE_KEY)) return false;
    sessionStorage.setItem(RELOAD_ONCE_KEY, '1');
  } catch { return false; } // storage unavailable → manual card, never a loop
  console.info('[sensei] stale chunk after deploy — reloading once to the current version');
  window.location.reload();
  return true;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Observability: a caught render error is otherwise swallowed silently (the UI
    // recovers, but nothing is logged). Surface it so it appears in the console / any
    // log capture, and as the single hook point to wire a real error reporter later
    // (e.g. Sentry) without touching the recovery UI.
    console.error('[ErrorBoundary] render error on route:', this.props.resetKey, error, info.componentStack);
    // Verified stale-client mismatch → one bounded automatic reload; the manual
    // recovery card below is the fallback if that single retry didn't resolve it.
    if (isStaleChunkError(error)) attemptStaleChunkReload();
  }

  override componentDidUpdate(prev: Props) {
    // clear the error when the route changes (navigation recovers the app)
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render() {
    if (this.state.error && isStaleChunkError(this.state.error)) {
      return (
        <div
          role="alert"
          style={{ maxWidth: 560, margin: '48px auto', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 16, padding: '32px 28px', textAlign: 'center', boxShadow: '0 1px 2px rgba(16,40,80,.06),0 6px 22px rgba(16,40,80,.07)' }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="var(--primary)" aria-hidden="true"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>גרסה חדשה של סנסיי זמינה</h1>
          <p style={{ margin: '0 0 20px', fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            המערכת עודכנה מאז הביקור האחרון. העבודה שלכם שמורה · רעננו כדי להמשיך בגרסה העדכנית.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ height: 44, padding: '0 24px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
          >
            רענון לגרסה העדכנית
          </button>
        </div>
      );
    }
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{ maxWidth: 560, margin: '48px auto', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 16, padding: '32px 28px', textAlign: 'center', boxShadow: '0 1px 2px rgba(16,40,80,.06),0 6px 22px rgba(16,40,80,.07)' }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="var(--error)" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>משהו השתבש במסך הזה</h1>
          <p style={{ margin: '0 0 20px', fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            העבודה שלכם נשמרה. נסו לרענן את המסך או לעבור למסך אחר.
          </p>
          <button
            onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}
            style={{ height: 44, padding: '0 24px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
          >
            חזרה לדף הבית
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
