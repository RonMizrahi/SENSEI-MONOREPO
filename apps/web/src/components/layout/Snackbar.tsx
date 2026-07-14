// Global toast / snackbar. Renders from S.toast (set via the store's toast()).
// role="alert" + aria-live so screen readers announce it; dismiss button and an
// optional action (e.g. "ביטול" for undo). Ported from the prototype overlays.
import { useApp } from '../../store/AppStore';

const ICONS: Record<string, string> = {
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
  success: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
};
const ACCENTS: Record<string, string> = {
  error: 'var(--error)', warning: 'var(--warning)', info: 'var(--info)', success: 'var(--success)',
};

export default function Snackbar() {
  const { S, set } = useApp();
  if (!S.toast) return null;

  const type = S.toast.type || 'success';
  const accent = ACCENTS[type] || ACCENTS.success;
  const icon = ICONS[type] || ICONS.success;
  const action = S.toast.action || null;

  const dismiss = () => set({ toast: null });
  const runAction = () => { set({ toast: null }); if (action && action.onClick) action.onClick(); };

  return (
    <div role="alert" aria-live="assertive" style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 210, display: 'flex', alignItems: 'center', gap: 11, background: 'var(--paper)', color: 'var(--text)', padding: '12px 16px', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,40,80,.22)', fontSize: 14.5, fontWeight: 600, animation: 'snackin .26s cubic-bezier(.2,.85,.25,1)' }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill={accent} style={{ flexShrink: 0 }}><path d={icon} /></svg>
      <span>{S.toast.msg}</span>
      {action && (
        <button onClick={runAction} className="shell-toast-action" style={{ display: 'flex', alignItems: 'center', gap: 5, marginInlineStart: 6, height: 30, padding: '0 13px', border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--primary)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" /></svg>
          {action.label || 'ביטול'}
        </button>
      )}
      <svg onClick={dismiss} className="shell-toast-x" role="button" tabIndex={0} aria-label="סגירת הודעה" viewBox="0 0 24 24" width="18" height="18" fill="var(--text-muted)" style={{ cursor: 'pointer', marginInlineStart: 4, flexShrink: 0 }}><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
    </div>
  );
}
