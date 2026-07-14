// Reusable share control — a menu button that shares a piece of content via WhatsApp or
// Email, built on the canonical share utils. Used only where content is naturally
// shareable (the clinical letter, a resource). For sensitive content, pass `note` to warn
// the user (patient details) before they share. Full ARIA menu-button keyboard pattern:
// the trigger opens on click / Enter / Space / ArrowDown; the open menu supports roving
// focus with ArrowUp/ArrowDown (wrapping) and Home/End; Escape or Tab closes; outside-click
// closes; focus moves to the first option on open and returns to the trigger on Escape.
// Reuses the app's toast, tokens and the shell-row-hover class — no new dependency, no
// CSS-file changes.
import React from 'react';
import { useApp } from '../../store/AppStore';
import { buildWhatsAppUrl, buildMailtoUrl, canShare } from '../../utils/share';

interface ShareMenuProps {
  subject: string
  text: string
  note?: string
  triggerLabel?: string
  triggerStyle?: React.CSSProperties
  triggerClassName?: string
}

const SHARE_ICON = 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';
const CHAT_ICON = 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z';
const MAIL_ICON = 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z';

const optStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start',
  padding: '10px 12px', border: 'none', borderRadius: 8, background: 'transparent',
  cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text)',
};

export default function ShareMenu({ subject, text, note, triggerLabel = 'שיתוף', triggerStyle, triggerClassName }: ShareMenuProps) {
  const { toast } = useApp();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const itemsRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const disabled = !canShare(text);

  React.useEffect(() => {
    if (!open) return undefined;
    itemsRef.current.find(Boolean)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  // Roving focus within the open menu (ARIA menu pattern); Tab closes it.
  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
    if (!items.length) return;
    if (e.key === 'Tab') { setOpen(false); return; }
    const cur = items.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === 'ArrowDown' ? cur + 1 :
      e.key === 'ArrowUp' ? cur - 1 :
      e.key === 'Home' ? 0 :
      e.key === 'End' ? items.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    items[(to + items.length) % items.length]?.focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' && !disabled) { e.preventDefault(); setOpen(true); }
  };

  const shareWhatsApp = () => {
    const url = buildWhatsAppUrl(text);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) toast('לא ניתן לפתוח את WhatsApp. ייתכן שחוסם החלונות הקופצים מונע זאת', 'error');
    else toast('נפתח שיתוף ב-WhatsApp');
    close();
  };
  const shareEmail = () => {
    window.location.href = buildMailtoUrl({ subject, body: text });
    toast('נפתחת טיוטת אימייל לשיתוף');
    close();
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef} type="button" disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        aria-haspopup="menu" aria-expanded={open} aria-label={triggerLabel}
        className={triggerClassName}
        style={{ display: 'flex', alignItems: 'center', gap: 7, ...triggerStyle, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={SHARE_ICON} /></svg>
        {triggerLabel}
      </button>

      {open && (
        <div role="menu" aria-label="אפשרויות שיתוף" onKeyDown={onMenuKey} style={{ position: 'absolute', top: 'calc(100% + 6px)', insetInlineEnd: 0, minWidth: 236, maxWidth: 'calc(100vw - 32px)', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: '0 14px 36px rgba(16,40,80,.2)', zIndex: 60, padding: 6, animation: 'pop .14s ease' }}>
          {note && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 10px', margin: '2px 2px 6px', fontSize: 12, color: 'var(--warning-strong)', background: 'var(--warning-bg)', borderRadius: 7, lineHeight: 1.45 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
              <span>{note}</span>
            </div>
          )}
          <button ref={(el) => { itemsRef.current[0] = el; }} role="menuitem" type="button" tabIndex={-1} onClick={shareWhatsApp} className="shell-row-hover" style={optStyle}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--success)" aria-hidden="true"><path d={CHAT_ICON} /></svg>
            שיתוף ב-WhatsApp
          </button>
          <button ref={(el) => { itemsRef.current[1] = el; }} role="menuitem" type="button" tabIndex={-1} onClick={shareEmail} className="shell-row-hover" style={optStyle}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)" aria-hidden="true"><path d={MAIL_ICON} /></svg>
            שליחה באימייל
          </button>
        </div>
      )}
    </div>
  );
}
