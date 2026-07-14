// ⌘K command palette + shared search helpers (relevance ranking, highlighting,
// and the unified destination list). Ported from the prototype renderVals().
// The palette and the appbar global search share ONE source of truth with the
// sidebar: every navConfig() destination is searchable, plus contextual quick-actions.
import React, { useEffect, useRef } from 'react';
import { useApp } from '../../store/AppStore';
import { navConfig } from '../../nav/navConfig';
import { avatarColors } from '../../utils';
import { scoreP, hlParts } from '../../utils/search';
import { patientInitials, patientAvatarColor } from '../../services/patients';
import { dayKey } from '../../services/calendar';
import { useFocusTrap } from '../../hooks/useFocusTrap';

// ---- unified destination list: navConfig() routes + contextual quick actions ----
export interface CmdRoute { label: string; icon: string; go: () => void }

export function buildCmdRoutes(app: { set: (p: any) => void; navigate: (r: string, p?: any) => void }): CmdRoute[] {
  const { set, navigate } = app;
  const CMD_ACTIONS: CmdRoute[] = [
    { label: 'העלאת הקלטה חדשה', icon: 'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z', go: () => set({ route: 'upload', upload: { state: 'idle', progress: 0, fileName: '', error: '' } }) },
    { label: 'קביעת פגישה חדשה', icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z', go: () => set({ route: 'calendar', dialog: 'schedule', apptForm: { pid: 'p1', date: dayKey(new Date()), time: '11:00', dur: '50', description: '' }, errors: {} }) },
    { label: 'מטופל חדש', icon: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', go: () => set({ dialog: 'create', form: { name: '', phone: '', email: '' }, errors: {} }) },
    { label: 'מרכז ההתראות', icon: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z', go: () => navigate('notifications') },
    // 'עזרה ותמיכה' is intentionally not repeated here — it is now a navConfig
    // destination, so it flows into the palette + global search + sidebar from that
    // single source (added below via the navConfig spread).
  ];
  return [
    ...navConfig().filter((n) => n.key).map((n) => ({ label: n.label as string, icon: n.icon as string, go: () => navigate(n.key as string) })),
    ...CMD_ACTIONS,
  ];
}

const kbdStyle: React.CSSProperties = { fontSize: 10.5, background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 4, padding: '2px 6px' };

export default function CommandPalette() {
  const { S, set, navigate } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(S.cmdOpen);

  useEffect(() => { if (S.cmdOpen && inputRef.current) inputRef.current.focus(); }, [S.cmdOpen]);

  if (!S.cmdOpen) return null;

  const closeCmdPalette = () => set({ cmdOpen: false, cmdInput: '' });
  const CMD_ROUTES = buildCmdRoutes({ set, navigate });
  const cq = (S.cmdInput || '').trim();
  // Empty query → genuinely recently-viewed patients (most-recent-first), falling
  // back to the first few on a fresh session so the "מטופלים אחרונים" list is never
  // empty. A query → ranked search results.
  const recentPatients = (S.recentPatientIds || [])
    .map((id: string) => S.patients.find((p: any) => p.id === id))
    .filter(Boolean);
  const patResults = cq
    ? S.patients.map((p: any) => ({ p, s: scoreP(p, cq) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).slice(0, 5).map((x: any) => x.p)
    : (recentPatients.length ? recentPatients : S.patients).slice(0, 4);
  const routeResults = CMD_ROUTES.filter((r) => !cq || r.label.includes(cq));
  const cmdPatientsLabel = cq ? 'מטופלים' : 'מטופלים אחרונים';
  // unified, keyboard-navigable result list: patients first, then routes (matches render order)
  const cmdActions = [
    ...patResults.map((p: any) => () => { set({ cmdOpen: false, cmdInput: '', cmdIndex: 0 }); navigate('patient', { patientId: p.id }); }),
    ...routeResults.map((r) => () => { set({ cmdOpen: false, cmdInput: '', cmdIndex: 0 }); r.go(); }),
  ];
  const cmdTotal = cmdActions.length;
  const cmdSel = cmdTotal ? Math.max(0, Math.min(S.cmdIndex, cmdTotal - 1)) : 0;
  // id of the active option, so the input can expose it via aria-activedescendant
  // (screen readers announce the highlighted result as ArrowUp/Down moves it).
  const cmdActiveId = cmdTotal ? 'cmdopt-' + cmdSel : undefined;
  const cmdNoResults = !!cq && patResults.length === 0 && routeResults.length === 0;

  const onCmdKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (cmdTotal) set({ cmdIndex: (cmdSel + 1) % cmdTotal }); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (cmdTotal) set({ cmdIndex: (cmdSel - 1 + cmdTotal) % cmdTotal }); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (cmdActions[cmdSel]) cmdActions[cmdSel](); }
  };

  return (
    <>
      <div onClick={closeCmdPalette} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,40,.5)', zIndex: 180, backdropFilter: 'blur(2px)' }} />
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label="פלטת פקודות" style={{ position: 'fixed', top: '14vh', left: '50%', transform: 'translateX(-50%)', width: 560, maxWidth: 'calc(100vw - 32px)', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 16, boxShadow: '0 28px 80px rgba(8,20,50,.35)', zIndex: 181, overflow: 'hidden', animation: 'pop .18s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--text-muted)"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z" /></svg>
          <input ref={inputRef} value={S.cmdInput} onInput={(e: any) => set({ cmdInput: e.target.value, cmdIndex: 0 })} onKeyDown={onCmdKey} role="combobox" aria-expanded={true} aria-controls="cmd-listbox" aria-autocomplete="list" aria-activedescendant={cmdActiveId} aria-label="חיפוש פקודות ומטופלים" placeholder="חיפוש או פקודה…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent', color: 'var(--text)' }} />
          <kbd dir="ltr" style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 5, padding: '3px 7px', color: 'var(--text-muted)' }}>Esc</kbd>
        </div>
        <div role="listbox" id="cmd-listbox" aria-label="תוצאות" style={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {patResults.length > 0 && (
            <>
              <div style={{ padding: '6px 18px 4px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>{cmdPatientsLabel}</div>
              {patResults.map((p: any, i: number) => {
                const a = avatarColors(patientAvatarColor(p.id)); const active = i === cmdSel;
                const initials = patientInitials(p.name);
                return (
                  <div key={p.id} id={'cmdopt-' + i} onClick={cmdActions[i]} onMouseEnter={() => { if (S.cmdIndex !== i) set({ cmdIndex: i }); }} role="option" aria-selected={active ? 'true' : 'false'} className="shell-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: a.bg, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                        {hlParts(p.name, cq).map((np, j) => <span key={j} style={{ background: np.bg, fontWeight: np.fw, borderRadius: 3 }}>{np.t}</span>)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{p.phone}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {routeResults.length > 0 && (
            <>
              <div style={{ padding: '6px 18px 4px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>ניווט</div>
              {routeResults.map((r, i) => {
                const gi = patResults.length + i; const active = gi === cmdSel;
                return (
                  <div key={r.label} id={'cmdopt-' + gi} onClick={cmdActions[gi]} onMouseEnter={() => { if (S.cmdIndex !== gi) set({ cmdIndex: gi }); }} role="option" aria-selected={active ? 'true' : 'false'} className="shell-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--text-secondary)"><path d={r.icon} /></svg>
                    </div>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{r.label}</span>
                  </div>
                );
              })}
            </>
          )}
          {cmdNoResults && (
            <div style={{ padding: '26px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, marginBottom: 3 }}>אין תוצאות תואמות</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>נסו שם מטופל או פקודה אחרת</div>
            </div>
          )}
          <div style={{ padding: '10px 18px 6px', borderTop: '1px solid var(--line)', display: 'flex', gap: 14, marginTop: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><kbd dir="ltr" style={kbdStyle}>↑↓</kbd>ניווט</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><kbd dir="ltr" style={kbdStyle}>Enter</kbd>בחירה</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><kbd dir="ltr" style={kbdStyle}>Esc</kbd>סגירה</span>
          </div>
        </div>
      </div>
    </>
  );
}
