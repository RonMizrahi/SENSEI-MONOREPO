// Shared pagination bar — port of Pager.dc.html (used by the patients,
// sessions and documents tables). Receives the view model produced by
// useApp().pager(items, pageKey, sizeKey).view as the `p` prop.
import React from 'react';

export default function Pager({ p }: { p: any }) {
  if (!p || !p.show) return null;
  const onKey = (e: React.KeyboardEvent) => {
    // RTL-aware: ArrowRight = previous page, ArrowLeft = next page
    if (e.key === 'ArrowRight') { if (!p.prevDisabled && p.onPrev) { e.preventDefault(); p.onPrev(); } }
    else if (e.key === 'ArrowLeft') { if (!p.nextDisabled && p.onNext) { e.preventDefault(); p.onNext(); } }
    else if (e.key === 'Home') { if (!p.prevDisabled && p.onFirst) { e.preventDefault(); p.onFirst(); } }
    else if (e.key === 'End') { if (!p.nextDisabled && p.onLast) { e.preventDefault(); p.onLast(); } }
  };
  return (
    <nav aria-label="ניווט בין עמודים" onKeyDown={onKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 20px', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span aria-live="polite" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.rangeLabel}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>שורות</span>
          <div role="group" aria-label="שורות בעמוד" style={{ display: 'inline-flex', border: '1px solid var(--divider)', borderRadius: 8, overflow: 'hidden' }}>
            {p.sizeOpts.map((s: any) => (
              <button key={s.n} onClick={s.onClick} aria-pressed={s.active} className="pager-size-btn" style={{ height: 30, minWidth: 34, padding: '0 9px', border: 'none', borderInlineStart: '1px solid var(--divider)', background: s.bg, color: s.color, fontSize: 12.5, fontWeight: s.weight, cursor: 'pointer', fontFamily: 'inherit' }}>{s.n}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <button onClick={p.onPrev} disabled={p.prevDisabled} aria-label="עמוד קודם" className="pager-nav-btn" style={{ width: 34, height: 34, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: p.prevCursor, color: 'var(--text-muted)', opacity: p.prevOpacity, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" /></svg>
        </button>
        {p.pageItems.map((pg: any, i: number) => pg.gap
          ? <span key={'g' + i} aria-hidden="true" style={{ minWidth: 26, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, userSelect: 'none' }}>…</span>
          : <button key={pg.n} onClick={pg.onClick} aria-current={pg.ariaCurrent} aria-label={'עמוד ' + pg.n} className="pager-page-btn" style={{ minWidth: 34, height: 34, padding: '0 9px', border: '1px solid ' + pg.border, borderRadius: 8, background: pg.bg, color: pg.color, cursor: 'pointer', fontWeight: pg.weight, fontSize: 13.5, fontFamily: 'inherit' }}>{pg.n}</button>)}
        <button onClick={p.onNext} disabled={p.nextDisabled} aria-label="עמוד הבא" className="pager-nav-btn" style={{ width: 34, height: 34, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: p.nextCursor, color: 'var(--text-muted)', opacity: p.nextOpacity, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
        </button>
      </div>
    </nav>
  );
}
