// Dashboard home — a Google-Calendar-style week view. Replaces the former
// stat-list dashboard (design: "Sensei App" prototype, CalendarHome). Events
// come from the same source as CalendarPage — loadCalendarEvents (demo fixture
// now, senseiapi `/calendar` when configured) — merged with locally-scheduled
// appointments, so nothing is hardcoded and it lights up with a real backend.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppStore';
import {
  defaultScheduleForm,
  eventGuestName,
  formatWeekRange,
  type CalendarUiEvent,
} from '../services/calendar';
import { useWeekEvents } from '../hooks/useWeekEvents';
import { CATEGORY_ORDER, SESSION_CATEGORIES, categoryOf } from '../data/sessionCategories';
import './dashboard.css';

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const DAY_START = 8, DAY_END = 19, HOUR = 54;
const bodyH = (DAY_END - DAY_START) * HOUR;
const GUTTER = 58;

const toMin = (d: Date) => d.getHours() * 60 + d.getMinutes();
const topFor = (min: number) => ((min - DAY_START * 60) / 60) * HOUR;
const fmtTime = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DashboardPage() {
  const { S, set, navigate } = useApp();

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [nowMin, setNowMin] = useState(() => toMin(new Date()));

  const today = new Date();
  const { events: weekEvents, loading, weekStartDate: wkStart } = useWeekEvents(weekAnchor, S.scheduledAppts || [], S.patients);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(wkStart); d.setDate(wkStart.getDate() + i); return d; }),
    [wkStart],
  );

  // live "now" line — refresh each minute
  useEffect(() => {
    const id = setInterval(() => setNowMin(toMin(new Date())), 60000);
    return () => clearInterval(id);
  }, []);

  const rangeTitle = formatWeekRange(weekAnchor);
  const shiftWeek = (delta: number) => setWeekAnchor((prev) => { const d = new Date(prev); d.setDate(d.getDate() + delta * 7); return d; });

  const openEvent = (ev: CalendarUiEvent) => {
    let pid = ev.patientId ?? null;
    if (!pid) { const name = eventGuestName(ev); pid = S.patients.find((p: any) => p.name === name)?.id ?? null; }
    if (pid) navigate('patient', { patientId: pid }); else navigate('calendar');
  };
  const openSchedule = () =>
    set({ dialog: 'schedule', apptForm: defaultScheduleForm(S.patientId || S.patients[0]?.id || 'p1'), errors: {} });

  const hourLabels = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

  // ----- mini month (of the viewed week) -----
  const miniMonthDate = days[3]; // mid-week → the month the week mostly sits in
  const mFirst = new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth(), 1);
  const mDays = new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth() + 1, 0).getDate();
  const miniCells: (number | null)[] = [];
  for (let i = 0; i < mFirst.getDay(); i++) miniCells.push(null);
  for (let d = 1; d <= mDays; d++) miniCells.push(d);
  const pickMiniDay = (d: number) => {
    const picked = new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth(), d);
    setWeekAnchor(picked);
  };

  return (
    <div className="calh-root">
      {/* ---- toolbar ---- */}
      <div className="calh-toolbar">
        <button type="button" className="calh-today-btn" onClick={() => setWeekAnchor(new Date())}>היום</button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="calh-icon-btn" aria-label="השבוע הקודם" onClick={() => shiftWeek(-1)}>‹</button>
          <button type="button" className="calh-icon-btn" aria-label="השבוע הבא" onClick={() => shiftWeek(1)}>›</button>
        </div>
        <h1 dir="ltr" aria-label={'יומן שבועי · ' + rangeTitle} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', textAlign: 'start' }}>{rangeTitle}</h1>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--divider)' }} role="group" aria-label="תצוגת יומן">
          <button type="button" className="calh-seg-btn" aria-pressed={false} onClick={() => navigate('calendar')}>חודש</button>
          <button type="button" className="calh-seg-btn" aria-pressed>שבוע</button>
          <button type="button" className="calh-seg-btn" aria-pressed={false} onClick={() => navigate('calendar')}>יום</button>
        </div>
        <button type="button" className="calh-new-btn" onClick={openSchedule}>
          <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>+</span>פגישה חדשה
        </button>
      </div>

      {/* ---- body: week grid + side panel ---- */}
      <div className="calh-body">
        <div className="calh-grid-wrap">
          {loading && (
            <div style={{ height: 3, background: 'var(--primary-tint)', overflow: 'hidden' }}>
              <div style={{ height: 3, width: '55%', background: 'var(--primary)', animation: 'loadbar 1.1s cubic-bezier(.4,0,.2,1) infinite' }} />
            </div>
          )}
          <div className="calh-grid-scroll">
            <div style={{ minWidth: 720, display: 'flex', flexDirection: 'column' }}>
              {/* header row */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 3 }}>
                <div style={{ width: GUTTER, flexShrink: 0 }} />
                {days.map((d, i) => {
                  const isToday = sameDay(d, today);
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderInlineStart: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 4 }}>{HE_DAYS[i]}</div>
                      <div style={{ width: 34, height: 34, lineHeight: '34px', borderRadius: '50%', margin: '0 auto', fontSize: 16, fontWeight: 700, background: isToday ? 'var(--primary)' : 'transparent', color: isToday ? 'var(--on-accent)' : 'var(--text)' }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {/* grid body */}
              <div style={{ display: 'flex', height: bodyH }}>
                {/* hour gutter */}
                <div style={{ width: GUTTER, flexShrink: 0, position: 'relative' }}>
                  {hourLabels.map((h) => (
                    <div key={h} dir="ltr" style={{ position: 'absolute', top: topFor(h * 60) - 7, insetInlineEnd: 8, fontSize: 11, color: 'var(--text-muted)' }}>{String(h).padStart(2, '0')}:00</div>
                  ))}
                </div>
                {/* day columns */}
                {days.map((d, i) => {
                  const isToday = sameDay(d, today);
                  // all-day events (e.g. a fixture training day) carry no start
                  // time, so they can't be placed on the timed grid — skip them
                  const dayEvents = weekEvents.filter((e) => !e.allDay && sameDay(new Date(e.start), d));
                  return (
                    <div key={i} style={{ flex: 1, position: 'relative', borderInlineStart: '1px solid var(--line)', height: bodyH }}>
                      {hourLabels.map((h) => (
                        <div key={h} style={{ position: 'absolute', insetInline: 0, top: topFor(h * 60), borderTop: '1px solid var(--line)' }} />
                      ))}
                      {isToday && nowMin >= DAY_START * 60 && nowMin <= DAY_END * 60 && (
                        <div style={{ position: 'absolute', insetInline: 0, top: topFor(nowMin), height: 0, borderTop: '2px solid var(--now-line)', zIndex: 2 }}>
                          <div style={{ position: 'absolute', insetInlineStart: -4, top: -5, width: 9, height: 9, borderRadius: '50%', background: 'var(--now-line)' }} />
                        </div>
                      )}
                      {dayEvents.map((ev) => {
                        const start = new Date(ev.start), end = new Date(ev.end);
                        const startMin = toMin(start);
                        const durMin = Math.max(20, (end.getTime() - start.getTime()) / 60000);
                        const c = SESSION_CATEGORIES[categoryOf(ev.title, ev.description)];
                        const short = durMin <= 50;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className="calh-event"
                            onClick={() => openEvent(ev)}
                            aria-label={eventGuestName(ev) + ' · ' + fmtTime(start)}
                            style={{ position: 'absolute', top: topFor(startMin) + 1, height: (durMin / 60) * HOUR - 3, insetInline: 3, background: c.bg, borderRadius: 7, borderInlineStart: '3px solid ' + c.bar, padding: short ? '3px 8px' : '5px 8px', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'start', font: 'inherit' }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eventGuestName(ev)}</span>
                            <span style={{ fontSize: 11, color: c.text, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {short ? (<><span dir="ltr">{fmtTime(start)}</span>{' · ' + c.label}</>) : c.label}
                            </span>
                            {!short && <span dir="ltr" style={{ fontSize: 11, color: c.text, opacity: 0.7, textAlign: 'start' }}>{fmtTime(start) + '–' + fmtTime(end)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ---- side panel ---- */}
        <aside className="calh-side">
          <button type="button" className="calh-create-btn" onClick={openSchedule}>
            <span aria-hidden style={{ fontSize: 19, lineHeight: 1 }}>+</span>יצירת פגישה
          </button>

          <div className="calh-card" style={{ padding: '14px 14px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, textAlign: 'center' }}>{HE_MONTHS[miniMonthDate.getMonth()] + ' ' + miniMonthDate.getFullYear()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
              {HE_DAYS_SHORT.map((d, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {miniCells.map((c, i) => {
                if (c === null) return <div key={i} />;
                const cellDate = new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth(), c);
                const isToday = sameDay(cellDate, today);
                const inWeek = cellDate >= days[0] && cellDate <= days[6];
                return (
                  <button
                    key={i}
                    type="button"
                    className="calh-mini-day"
                    onClick={() => pickMiniDay(c)}
                    aria-label={c + ' ' + HE_MONTHS[miniMonthDate.getMonth()]}
                    aria-current={isToday ? 'date' : undefined}
                    style={{ fontSize: 11.5, textAlign: 'center', lineHeight: '26px', height: 26, borderRadius: '50%', fontWeight: isToday ? 700 : 500, background: isToday ? 'var(--primary)' : inWeek ? 'var(--primary-tint)' : 'transparent', color: isToday ? 'var(--on-accent)' : 'var(--text-2)' }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="calh-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>סוגי פגישות</div>
            {CATEGORY_ORDER.map((k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px' }}>
                <span aria-hidden style={{ width: 15, height: 15, borderRadius: 4, background: SESSION_CATEGORIES[k].bar, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{SESSION_CATEGORIES[k].label}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
