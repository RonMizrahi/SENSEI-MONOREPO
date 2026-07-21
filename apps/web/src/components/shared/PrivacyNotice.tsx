// Reusable privacy notice: a subtle "ההקלטה שלך מאובטחת" line + a "?" disclosure
// that reveals the app's ACTUAL, capability-derived privacy facts (single source
// of truth: data/privacyNotice). Reused on the upload experience and the Help
// hub. If no capability metadata resolves, it falls back to a generic message
// rather than asserting specifics. Accessible: the "?" is a real button with
// aria-expanded/aria-controls; the panel closes on Escape (focus returns) and on
// outside click; RTL-safe with logical properties.
import { useEffect, useId, useRef, useState } from 'react';
import { isApiConfigured } from '../../services/apiClient';
import {
  PRIVACY_HEADLINE, PRIVACY_TOOLTIP_TITLE, PRIVACY_FALLBACK,
  resolvePrivacyCapabilities, privacyItems,
} from '../../data/privacyNotice';

export default function PrivacyNotice({ apiConfigured = isApiConfigured() }: { apiConfigured?: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const items = privacyItems(resolvePrivacyCapabilities(apiConfigured));

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--primary)" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
      </svg>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{PRIVACY_HEADLINE}</span>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={PRIVACY_TOOLTIP_TITLE}
        aria-expanded={open}
        aria-controls={panelId}
        className="tap44"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-input)', background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, lineHeight: 1 }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={PRIVACY_TOOLTIP_TITLE}
          style={{ position: 'absolute', top: 'calc(100% + 8px)', insetInlineStart: 0, zIndex: 60, width: 288, maxWidth: 'calc(100vw - 32px)', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, boxShadow: '0 16px 44px rgba(8,20,50,.24)', padding: '14px 16px', textAlign: 'start' }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{PRIVACY_TOOLTIP_TITLE}</div>
          {items.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{PRIVACY_FALLBACK}</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.map((it) => (
                <li key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-2)' }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--primary)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><path d={it.icon} /></svg>
                  <span>{it.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
