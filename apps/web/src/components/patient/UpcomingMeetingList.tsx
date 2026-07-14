import { dayKey, type CalendarUiEvent } from '../../services/calendar';

export const fmtTime = (d: Date) =>
  String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

export const formatMeetingWhen = (start: Date) => {
  const todayKey = dayKey(new Date());
  const key = dayKey(start);
  const time = fmtTime(start);
  if (key === todayKey) return 'היום · ' + time;
  return new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short' }).format(start) + ' · ' + time;
};

interface UpcomingMeetingListProps {
  meetings: CalendarUiEvent[]
  onSelect: (event: CalendarUiEvent) => void
  onDelete?: (event: CalendarUiEvent, e: React.MouseEvent) => void
}

export default function UpcomingMeetingList({ meetings, onSelect, onDelete }: UpcomingMeetingListProps) {
  if (meetings.length === 0) {
    return <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>אין פגישות מתוכננות</div>;
  }

  return (
    <>
      {meetings.map((m) => {
        const start = new Date(m.start);
        const end = new Date(m.end);
        return (
          <div
            key={m.id}
            className="pd-upcoming-row"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)' }}
          >
            <button
              type="button"
              onClick={() => onSelect(m)}
              aria-label={formatMeetingWhen(start)}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'start', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1.1 }}>
                <span dir="ltr" style={{ fontSize: 13, fontWeight: 800 }}>{fmtTime(start)}</span>
                <span dir="ltr" style={{ fontSize: 10, opacity: 0.75 }}>{fmtTime(end)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{formatMeetingWhen(start)}</div>
                {m.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.description}</div>
                )}
              </div>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--text-muted)" style={{ flexShrink: 0 }}><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" /></svg>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(m, e); }}
                aria-label="מחיקת פגישה"
                className="pat-del-btn"
                style={{ width: 30, height: 30, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--error)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
