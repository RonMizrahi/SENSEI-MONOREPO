// Dashboard home — a Google-Calendar-style week view. Replaces the former
// stat-list dashboard (design: "Sensei App" prototype, CalendarHome). Events
// come from the same source as CalendarPage — loadCalendarEvents (demo fixture
// now, senseiapi `/calendar` when configured) — merged with locally-scheduled
// appointments, so nothing is hardcoded and it lights up with a real backend.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store/AppStore';
import {
  dayKey,
  defaultScheduleForm,
  eventGuestName,
  formatWeekRange,
  toCalEventDetail,
  type CalendarUiEvent,
} from '../services/calendar';
import { useWeekEvents } from '../hooks/useWeekEvents';
import { useTts } from '../hooks/useTts';
import { sessionSummaries } from '../data/sessions';
import { heCount, heGreeting } from '../utils';
import { HE_DAYS, HE_DAYS_SHORT, HE_MONTHS, fmtTime, sameDay } from '../utils/dates';
import DashboardFocus from '../components/DashboardFocus';
import DashboardSummary from '../components/DashboardSummary';
import { CATEGORY_ORDER, SESSION_CATEGORIES, categoryOf } from '../data/sessionCategories';
import './dashboard.css';

const DAY_START = 8, DAY_END = 19, HOUR = 54;
const bodyH = (DAY_END - DAY_START) * HOUR;
const GUTTER = 58;

const toMin = (d: Date) => d.getHours() * 60 + d.getMinutes();
const topFor = (min: number) => ((min - DAY_START * 60) / 60) * HOUR;

export default function DashboardPage() {
  const { S, set, toast, navigate } = useApp();
  const tts = useTts();
  const connectGoogleCalendar = () => toast('חיבור ל-Google Calendar יתווסף בקרוב · בינתיים הנתונים מנוהלים מקומית', 'info');
  const startCoreFlow = () => navigate('upload', { upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  const dismissTip = () => set({ onboardTipDismissed: true });

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [nowMin, setNowMin] = useState(() => toMin(new Date()));
  const [calView, setCalView] = useState<'week' | 'day' | 'month'>('week');
  const [dragId, setDragId] = useState<string | null>(null);

  const today = new Date();
  const { events: weekEvents, loading, error: weekError, reload: reloadWeek, weekStartDate: wkStart } = useWeekEvents(weekAnchor, S.scheduledAppts || [], S.patients);
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

  // ----- view mode (week / day / month) -----
  const dayDate = useMemo(() => { const d = new Date(weekAnchor); d.setHours(0, 0, 0, 0); return d; }, [weekAnchor]);
  const gridDays = calView === 'day' ? [dayDate] : days;
  const shiftBy = (delta: number) => {
    if (calView === 'week') { shiftWeek(delta); return; }
    setWeekAnchor((prev) => {
      const d = new Date(prev);
      if (calView === 'day') d.setDate(d.getDate() + delta);
      else d.setMonth(d.getMonth() + delta);
      return d;
    });
  };
  const viewTitle = calView === 'week'
    ? rangeTitle
    : calView === 'day'
      ? new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dayDate)
      : HE_MONTHS[dayDate.getMonth()] + ' ' + dayDate.getFullYear();
  const prevLabel = calView === 'week' ? 'השבוע הקודם' : calView === 'day' ? 'היום הקודם' : 'החודש הקודם';
  const nextLabel = calView === 'week' ? 'השבוע הבא' : calView === 'day' ? 'היום הבא' : 'החודש הבא';

  // Click an empty slot / day to schedule, prefilling the date (and time on the grid).
  const createAt = (date: Date, min?: number) => {
    const pid = S.patientId || S.patients[0]?.id || 'p1';
    let time = '09:00';
    if (min != null) {
      const clamped = Math.max(DAY_START * 60, Math.min(DAY_END * 60 - 30, min));
      const snap = Math.floor(clamped / 30) * 30;
      time = String(Math.floor(snap / 60)).padStart(2, '0') + ':' + String(snap % 60).padStart(2, '0');
    }
    set({ dialog: 'schedule', apptForm: { pid, date: dayKey(date), time, dur: '50', description: '' }, errors: {} });
  };
  const onColumnClick = (d: Date) => (e: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    createAt(d, DAY_START * 60 + ((e.clientY - rect.top) / HOUR) * 60);
  };

  // Drag-and-drop: move a locally-scheduled appointment to a new day/time.
  // (Fixture demo events aren't in the local schedule and can't be dragged;
  // click-to-edit via the details dialog remains the keyboard-accessible path.)
  const isDraggable = (ev: CalendarUiEvent) => (S.scheduledAppts || []).some((a: any) => a.id === ev.id);
  const snapTimeFromY = (rectTop: number, clientY: number) => {
    const raw = DAY_START * 60 + ((clientY - rectTop) / HOUR) * 60;
    const min = Number.isFinite(raw) ? raw : DAY_START * 60;
    const snap = Math.floor(Math.max(DAY_START * 60, Math.min(DAY_END * 60 - 30, min)) / 30) * 30;
    return String(Math.floor(snap / 60)).padStart(2, '0') + ':' + String(snap % 60).padStart(2, '0');
  };
  const onColumnDrop = (d: Date) => (e: any) => {
    if (!dragId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const time = snapTimeFromY(rect.top, e.clientY);
    const appt = (S.scheduledAppts || []).find((a: any) => a.id === dragId);
    setDragId(null);
    if (!appt) return;
    const dk = dayKey(d);
    if (appt.date === dk && appt.time === time) return; // no-op move
    set({ scheduledAppts: (S.scheduledAppts || []).map((a: any) => a.id === dragId ? { ...a, date: dk, time } : a) });
    const p = S.patients.find((x: any) => x.id === appt.pid);
    const dLabel = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' }).format(d);
    toast('הפגישה' + (p ? ' עם ' + p.name : '') + ' הועברה ל-' + dLabel + ' · ' + time);
  };

  // month grid (for the month view) — full dates + local appointment counts
  const mgFirst = new Date(dayDate.getFullYear(), dayDate.getMonth(), 1);
  const mgCount = new Date(dayDate.getFullYear(), dayDate.getMonth() + 1, 0).getDate();
  const monthCells: (Date | null)[] = [];
  for (let i = 0; i < mgFirst.getDay(); i++) monthCells.push(null);
  for (let dnum = 1; dnum <= mgCount; dnum++) monthCells.push(new Date(dayDate.getFullYear(), dayDate.getMonth(), dnum));
  const apptsOn = (date: Date) => (S.scheduledAppts || []).filter((a: any) => a.date === dayKey(date)).length;
  const openDayView = (date: Date) => { setWeekAnchor(date); setCalView('day'); };

  // Open the meeting-details dialog (not a jump to the Patients tab) so the
  // therapist sees the meeting, a recap, and per-meeting actions in place.
  const openEvent = (ev: CalendarUiEvent) => {
    let pid = ev.patientId ?? null;
    if (!pid) { const name = eventGuestName(ev); pid = S.patients.find((p: any) => p.name === name)?.id ?? null; }
    set({ dialog: 'calEvent', calEventDetail: toCalEventDetail(ev, pid) });
  };
  const openSchedule = () =>
    set({ dialog: 'schedule', apptForm: defaultScheduleForm(S.patientId || S.patients[0]?.id || 'p1'), errors: {} });

  // Daily "open the day" recap — read aloud (TTS) so the therapist can hear the
  // day's agenda over coffee without opening each file.
  const todaysEvents = weekEvents
    .filter((e) => !e.allDay && sameDay(new Date(e.start), today))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const dailyRecapText = todaysEvents.length
    ? 'סיכום פתיחת יום. יש לך ' + heCount(todaysEvents.length, 'פגישה אחת', 'פגישות') + ' היום. ' +
      todaysEvents.map((e) => eventGuestName(e) + ' בשעה ' + fmtTime(new Date(e.start))).join('. ') + '.'
    : 'סיכום פתיחת יום. אין לך פגישות מתוזמנות היום.';

  // Per-session recap playback (spec 1.2 — "השמעה למפגש זה"): hear one patient's
  // "previously on" from the agenda, without opening the file. Shares the page's
  // single TTS instance with the daily recap, so starting one stops the other;
  // playingEvId marks WHICH agenda row is speaking (cleared when speech ends).
  const [playingEvId, setPlayingEvId] = useState<string | null>(null);
  useEffect(() => { if (!tts.speaking) setPlayingEvId(null); }, [tts.speaking]);
  const playSessionRecap = (ev: CalendarUiEvent) => {
    if (playingEvId === ev.id) { tts.stop(); setPlayingEvId(null); return; }
    // Speak the FULL previous-session summary (recapFor trims for display only).
    const pid = pidOf(ev);
    const full = pid ? (sessionSummaries({ id: pid })[0] || '') : '';
    if (!full) return;
    tts.speak(eventGuestName(ev) + ', בשעה ' + fmtTime(new Date(ev.start)) + '. מהפגישה הקודמת: ' + full);
    setPlayingEvId(ev.id);
  };
  const toggleDailyRecap = () => { setPlayingEvId(null); tts.toggle(dailyRecapText); };

  const pidOf = (ev: CalendarUiEvent): string | null => {
    if (ev.patientId) return ev.patientId;
    const name = eventGuestName(ev);
    return S.patients.find((p: any) => p.name === name)?.id ?? null;
  };
  // "Previously on" — the patient's most recent session summary, trimmed to a line
  // for the today's-agenda list on the home screen.
  const recapFor = (ev: CalendarUiEvent): string => {
    const pid = pidOf(ev);
    if (!pid) return '';
    const sum = sessionSummaries({ id: pid })[0] || '';
    return sum.length > 96 ? sum.slice(0, 96).trim() + '…' : sum;
  };
  // The three per-session quick actions, reachable straight from the agenda row.
  const openFile = (pid: string) => navigate('patient', { patientId: pid });
  const uploadFor = (pid: string) => navigate('upload', { patientId: pid, upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  const prepReport = (pid: string) => navigate('report', { patientId: pid });

  // Personalized, time-aware greeting for the therapist's workspace.
  const greetWord = heGreeting(today);
  const therapistName = (S.profile && S.profile.name) || '';
  const todayLabel = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
  const followUpCount = todaysEvents.length;

  const hourLabels = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

  // Announce calendar view/date changes to screen readers (polite), skipping the
  // initial render so it only speaks in response to a navigation the user made.
  const calViewName = calView === 'week' ? 'תצוגת שבוע' : calView === 'day' ? 'תצוגת יום' : 'תצוגת חודש';
  const [announce, setAnnounce] = useState('');
  const firstNav = useRef(true);
  useEffect(() => {
    if (firstNav.current) { firstNav.current = false; return; }
    setAnnounce(calViewName + ' · ' + viewTitle);
  }, [viewTitle, calViewName]);

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
      <div aria-live="polite" className="sr-only">{announce}</div>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>{greetWord}{therapistName ? ', ' + therapistName : ''}</h1>
        <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          {todayLabel}{' · '}
          {followUpCount ? heCount(followUpCount, 'פגישה אחת היום', 'פגישות היום') : 'אין פגישות מתוזמנות היום'}
        </p>
      </div>

      {/* ---- at-a-glance workload ---- */}
      <DashboardSummary todayCount={todaysEvents.length} weekCount={weekEvents.filter((e) => !e.allDay).length} />

      {/* Onboarding tip — auto-hides once the core flow succeeded (hasUploaded):
          after a first upload it is no longer guidance, just noise. */}
      {!S.onboardTipDismissed && !S.hasUploaded && (
        <div role="note" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--paper)" aria-hidden="true"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>ברוכים הבאים לסנסיי</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5 }}>העלו הקלטה של מפגש כדי לקבל סיכום AI, תובנות מרכזיות ודוח הכנה לפגישה הבאה. הנתונים נשמרים מקומית במכשירכם.</div>
          </div>
          <button type="button" onClick={startCoreFlow} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></svg>
            העלאת הקלטה
          </button>
          <button type="button" onClick={dismissTip} aria-label="סגירת ההודעה" className="calh-icon-btn" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
      )}

      {/* ---- focus zone: who's next + resume work ---- */}
      <DashboardFocus />

      {/* ---- calendar ---- */}
      <h2 style={{ margin: '4px 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.02em' }}>היומן שלך</h2>
      {/* ---- toolbar ---- */}
      <div className="calh-toolbar">
        <button type="button" className="calh-today-btn" onClick={() => setWeekAnchor(new Date())}>היום</button>
        {tts.supported && (
          <button
            type="button"
            className="calh-new-btn"
            onClick={toggleDailyRecap}
            aria-label={tts.speaking && !playingEvId ? 'עצירת ההקראה' : 'הקראת סיכום פתיחת היום'}
            aria-pressed={tts.speaking && !playingEvId}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              {tts.speaking && !playingEvId ? <path d="M6 6h4v12H6zm8 0h4v12h-4z" /> : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z" />}
            </svg>
            {tts.speaking && !playingEvId ? 'עצירה' : 'סיכום יומי'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="calh-icon-btn" aria-label={prevLabel} onClick={() => shiftBy(-1)}>‹</button>
          <button type="button" className="calh-icon-btn" aria-label={nextLabel} onClick={() => shiftBy(1)}>›</button>
        </div>
        <h2 dir={calView === 'week' ? 'ltr' : 'rtl'} aria-label={'יומן · ' + viewTitle} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', textAlign: 'start' }}>{viewTitle}</h2>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--divider)' }} role="group" aria-label="תצוגת יומן">
          <button type="button" className="calh-seg-btn" aria-pressed={calView === 'month'} onClick={() => setCalView('month')}>חודש</button>
          <button type="button" className="calh-seg-btn" aria-pressed={calView === 'week'} onClick={() => setCalView('week')}>שבוע</button>
          <button type="button" className="calh-seg-btn" aria-pressed={calView === 'day'} onClick={() => setCalView('day')}>יום</button>
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
          {weekError && !loading && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--error-bg-soft)', borderBottom: '1px solid var(--error-line)' }}>
              <span style={{ flex: 1, minWidth: 180, fontSize: 13, fontWeight: 600, color: 'var(--error-dark)' }}>טעינת היומן נכשלה. הפגישות המקומיות עדיין מוצגות.</span>
              <button type="button" onClick={reloadWeek} style={{ height: 32, padding: '0 14px', border: '1px solid var(--error-border)', borderRadius: 8, background: 'var(--paper)', color: 'var(--error-dark)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>ניסיון חוזר</button>
            </div>
          )}
          <div className="calh-grid-scroll">
            {calView === 'month' ? (
              <div style={{ minWidth: 720 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                  {HE_DAYS.map((name, i) => (
                    <div key={i} style={{ padding: '10px 4px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--divider)' }}>{name}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                  {monthCells.map((cell, i) => {
                    if (!cell) return <div key={i} style={{ minHeight: 92, borderInlineStart: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }} />;
                    const isToday = sameDay(cell, today);
                    const n = apptsOn(cell);
                    return (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        aria-label={cell.getDate() + ' ' + HE_MONTHS[cell.getMonth()] + (n ? ' · ' + heCount(n, 'פגישה אחת', 'פגישות') : '')}
                        onClick={() => { if (n) openDayView(cell); else createAt(cell); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (n) openDayView(cell); else createAt(cell); } }}
                        className="calh-month-cell"
                        style={{ minHeight: 92, padding: 6, borderInlineStart: '1px solid var(--line)', borderBottom: '1px solid var(--line)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        <div style={{ width: 26, height: 26, lineHeight: '26px', borderRadius: '50%', textAlign: 'center', fontSize: 13, fontWeight: 700, alignSelf: 'flex-start', background: isToday ? 'var(--primary)' : 'transparent', color: isToday ? 'var(--on-accent)' : 'var(--text)' }}>{cell.getDate()}</div>
                        {n > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-tint)', borderRadius: 6, padding: '2px 7px', alignSelf: 'flex-start' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />{heCount(n, 'פגישה', 'פגישות')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
            <div style={{ minWidth: calView === 'day' ? 320 : 720, display: 'flex', flexDirection: 'column' }}>
              {/* header row */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 3 }}>
                <div style={{ width: GUTTER, flexShrink: 0 }} />
                {gridDays.map((d, i) => {
                  const isToday = sameDay(d, today);
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderInlineStart: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 4 }}>{HE_DAYS[d.getDay()]}</div>
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
                {gridDays.map((d, i) => {
                  const isToday = sameDay(d, today);
                  // all-day events (e.g. a fixture training day) carry no start
                  // time, so they can't be placed on the timed grid — skip them
                  const dayEvents = weekEvents.filter((e) => !e.allDay && sameDay(new Date(e.start), d));
                  return (
                    <div
                      key={i}
                      onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                      onDrop={onColumnDrop(d)}
                      style={{ flex: 1, position: 'relative', borderInlineStart: '1px solid var(--line)', height: bodyH, background: dragId ? 'var(--primary-tint)' : undefined }}
                    >
                      {/* empty-slot click target (labelled, a sibling of the event
                          buttons so it never nests interactive elements) */}
                      <button
                        type="button"
                        className="calh-col-add"
                        aria-label={'קביעת פגישה · ' + HE_DAYS[d.getDay()] + ' ' + d.getDate()}
                        onClick={onColumnClick(d)}
                        style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', padding: 0, margin: 0, cursor: 'pointer', zIndex: 0 }}
                      />
                      {hourLabels.map((h) => (
                        <div key={h} style={{ position: 'absolute', insetInline: 0, top: topFor(h * 60), borderTop: '1px solid var(--line)', pointerEvents: 'none' }} />
                      ))}
                      {isToday && nowMin >= DAY_START * 60 && nowMin <= DAY_END * 60 && (
                        <div style={{ position: 'absolute', insetInline: 0, top: topFor(nowMin), height: 0, borderTop: '2px solid var(--now-line)', zIndex: 2, pointerEvents: 'none' }}>
                          <div style={{ position: 'absolute', insetInlineStart: -4, top: -5, width: 9, height: 9, borderRadius: '50%', background: 'var(--now-line)' }} />
                        </div>
                      )}
                      {(() => {
                        // Overlapping events share the column side-by-side instead of
                        // stacking on top of each other: greedy lane assignment over the
                        // start-sorted list, then each event takes 1/lanes of the width.
                        const sorted = [...dayEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
                        const laneEnd: number[] = [];
                        const laneOf: Record<string, number> = {};
                        for (const ev of sorted) {
                          const s = new Date(ev.start).getTime();
                          const e = Math.max(s + 20 * 60000, new Date(ev.end).getTime());
                          let lane = laneEnd.findIndex((endT) => endT <= s);
                          if (lane === -1) { lane = laneEnd.length; laneEnd.push(0); }
                          laneEnd[lane] = e;
                          laneOf[ev.id] = lane;
                        }
                        const lanes = laneEnd.length || 1;
                        return sorted.map((ev) => {
                        const start = new Date(ev.start), end = new Date(ev.end);
                        const startMin = toMin(start);
                        const durMin = Math.max(20, (end.getTime() - start.getTime()) / 60000);
                        const c = SESSION_CATEGORIES[categoryOf(ev.title, ev.description)];
                        const short = durMin <= 50;
                        const laneW = (100 - 2) / lanes;
                        // 3+ lanes → each sliver is too narrow for a second line;
                        // show the name only and carry the details in the tooltip
                        // (the aria-label already announces name + time).
                        const dense = lanes >= 3;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className="calh-event"
                            draggable={isDraggable(ev)}
                            onDragStart={(e) => { setDragId(ev.id); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => setDragId(null)}
                            onClick={(e) => { e.stopPropagation(); openEvent(ev); }}
                            aria-label={eventGuestName(ev) + ' · ' + fmtTime(start)}
                            title={eventGuestName(ev) + ' · ' + fmtTime(start) + ' · ' + c.label}
                            style={{ position: 'absolute', top: topFor(startMin) + 1, height: (durMin / 60) * HOUR - 3, insetInlineStart: 'calc(' + (1 + laneOf[ev.id] * laneW) + '% + 2px)', width: 'calc(' + laneW + '% - 4px)', background: c.bg, borderRadius: 7, border: 'none', borderInlineStart: '3px solid ' + c.bar, padding: dense ? '3px 5px' : short ? '3px 8px' : '5px 8px', cursor: isDraggable(ev) ? 'grab' : 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'start', font: 'inherit', zIndex: 1, opacity: dragId === ev.id ? 0.4 : 1 }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eventGuestName(ev)}</span>
                            {!dense && (
                              <span style={{ fontSize: 11, color: c.text, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {short ? (<><span dir="ltr">{fmtTime(start)}</span>{' · ' + c.label}</>) : c.label}
                              </span>
                            )}
                            {!dense && !short && <span dir="ltr" style={{ fontSize: 11, color: c.text, opacity: 0.7, textAlign: 'start' }}>{fmtTime(start) + '–' + fmtTime(end)}</span>}
                          </button>
                        );
                        });
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        </div>

        {/* ---- side panel ---- */}
        {/* Priority order: today's actionable agenda first, quick date-nav second,
            then the roadmap Google-Calendar stub and the collapsed legend last —
            actions above information, information above future integrations. */}
        <aside className="calh-side">
          <div className="calh-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--primary)" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>
              הפגישות שלך היום
            </div>
            {todaysEvents.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>אין פגישות מתוזמנות היום.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todaysEvents.map((ev) => {
                  const recap = recapFor(ev);
                  const pid = pidOf(ev);
                  return (
                    <div key={ev.id} style={{ border: '1px solid var(--line)', borderRadius: 9, background: 'var(--paper)', padding: '9px 11px' }}>
                      <button
                        type="button"
                        onClick={() => openEvent(ev)}
                        className="calh-agenda-row"
                        aria-label={'פרטי הפגישה · ' + eventGuestName(ev) + ' · ' + fmtTime(new Date(ev.start))}
                        style={{ display: 'block', width: '100%', textAlign: 'start', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eventGuestName(ev)}</span>
                          <span dir="ltr" style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtTime(new Date(ev.start))}</span>
                        </div>
                        {recap && <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 3 }}>{recap}</div>}
                      </button>
                      {pid && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                          <button type="button" onClick={() => openFile(pid)} aria-label={'תיק המטופל · ' + eventGuestName(ev)} title="תיק מטופל" className="calh-agenda-act" style={{ flex: 1, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-input)', borderRadius: 7, background: 'var(--paper)', color: 'var(--text-2)', cursor: 'pointer' }}>
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>
                          </button>
                          <button type="button" onClick={() => uploadFor(pid)} aria-label={'העלאת הקלטה · ' + eventGuestName(ev)} title="העלאת הקלטה" className="calh-agenda-act" style={{ flex: 1, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-input)', borderRadius: 7, background: 'var(--paper)', color: 'var(--text-2)', cursor: 'pointer' }}>
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></svg>
                          </button>
                          <button type="button" onClick={() => prepReport(pid)} aria-label={'דוח הכנה · ' + eventGuestName(ev)} title="דוח הכנה" className="calh-agenda-act" style={{ flex: 1, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-input)', borderRadius: 7, background: 'var(--paper)', color: 'var(--text-2)', cursor: 'pointer' }}>
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z" /></svg>
                          </button>
                          {tts.supported && recap && (
                            <button
                              type="button"
                              onClick={() => playSessionRecap(ev)}
                              aria-label={(playingEvId === ev.id ? 'עצירת ההשמעה · ' : 'השמעת תקציר למפגש · ') + eventGuestName(ev)}
                              aria-pressed={playingEvId === ev.id}
                              title={playingEvId === ev.id ? 'עצירת ההשמעה' : 'השמעת תקציר למפגש'}
                              className="calh-agenda-act"
                              style={{ flex: 1, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + (playingEvId === ev.id ? 'var(--primary)' : 'var(--border-input)'), borderRadius: 7, background: playingEvId === ev.id ? 'var(--primary-tint)' : 'var(--paper)', color: playingEvId === ev.id ? 'var(--primary)' : 'var(--text-2)', cursor: 'pointer' }}
                            >
                              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                                {playingEvId === ev.id ? <path d="M6 6h4v12H6zm8 0h4v12h-4z" /> : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z" />}
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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

          <button
            type="button"
            onClick={connectGoogleCalendar}
            className="calh-gcal-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', height: 42, border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--primary)" aria-hidden="true"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" /></svg>
            חיבור ל-Google Calendar
          </button>

          {/* Category legend — collapsed by default (progressive disclosure): every
              event block already prints its own category label, so the legend is
              secondary decoding aid, not primary information. Native <details>
              keeps it keyboard-accessible with zero JS. */}
          <details className="calh-card calh-legend" style={{ padding: '10px 16px 12px' }}>
            <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', padding: '4px 0' }}>סוגי פגישות</summary>
            <div style={{ marginTop: 6 }}>
              {CATEGORY_ORDER.map((k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px' }}>
                  <span aria-hidden style={{ width: 15, height: 15, borderRadius: 4, background: SESSION_CATEGORIES[k].bar, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{SESSION_CATEGORIES[k].label}</span>
                </div>
              ))}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
