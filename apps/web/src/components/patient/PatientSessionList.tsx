// Compact session rows — click opens the session detail page.
type SessionRow = {
  num: number
  key?: string
  date: string
  duration: string
  summary: string
  riskChips: { label: string; color: string; bg: string }[]
  hasNote: boolean
  onOpen: () => void
  onDelete?: (e?: { stopPropagation?: () => void }) => void
};

export default function PatientSessionList({ sessions }: { sessions: SessionRow[] }) {
  if (!sessions.length) {
    return (
      <div style={{ fontSize: 13.5, color: 'var(--text-muted)', padding: '8px 0' }}>
        אין פגישות קודמות
      </div>
    );
  }
  return (
    <>
      {sessions.map((s, i) => (
        <div
          key={s.key || s.num}
          className="pd-sess-row"
          // Divider between rows only (none above the first — no stray top line),
          // using the standard divider token so it reads as a deliberate subtle
          // separator in BOTH themes (--line is near-white on the light card).
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid var(--divider)' }}
        >
          <button
            type="button"
            onClick={s.onOpen}
            aria-label={'פגישה ' + s.num}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'start', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{s.num}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>פגישה {s.num}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 3 }}><span dir="ltr">{s.date}</span> · {s.duration}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.summary}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {s.riskChips.map((rc) => (
                <span key={rc.label} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: rc.bg, color: rc.color }}>{rc.label}</span>
              ))}
              {s.hasNote && (
                <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--text-muted)" aria-label="קיימת הערה"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" /></svg>
              )}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--text-muted)"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" /></svg>
            </div>
          </button>
          {s.onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); s.onDelete?.(e); }}
              aria-label={'מחיקת פגישה ' + s.num}
              className="pat-del-btn"
              style={{ width: 30, height: 30, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--error)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            </button>
          )}
        </div>
      ))}
    </>
  );
}
