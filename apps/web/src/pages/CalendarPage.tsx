// Calendar — week view backed by senseiapi `/calendar` when configured, with a
// local fixture fallback. View-state (week anchor, selected day) stays local.
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CARD_SHADOW } from '../utils/styles';
import { HE_MONTHS_IN, fmtTime } from '../utils/dates';
import { useApp } from '../store/AppStore';
import { isApiConfigured } from '../services/apiClient';
import './calendar.css';
import {
  dayKey,
  defaultScheduleForm,
  formatWeekRange,
  loadCalendarEvents,
  weekEnd,
  weekStart,
} from '../services/calendar';

// ---- date helpers ----
const hebDate = (key: string) => {
  const p = String(key).split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return d.getDate() + ' ' + HE_MONTHS_IN[d.getMonth()] + ' ' + d.getFullYear();
};
const fmt = fmtTime;
const initialsOf = (name: string) => {
  const parts = (name || '').trim().split(/\s+/);
  return (((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '')) || '•';
};
const relSync = (ts: number | null) => {
  if (!ts) return '—';
  const d = Math.max(0, Date.now() - ts);
  const m = Math.floor(d / 60000);
  if (d < 30000) return 'עודכן זה עתה';
  if (m < 1) return 'עודכן לפני פחות מדקה';
  if (m < 60) return 'עודכן לפני ' + m + ' דק׳';
  const h = Math.floor(m / 60);
  return 'עודכן לפני ' + h + ' שע׳';
};

type CalStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'
const DAYL = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export default function CalendarPage() {
  const { S, set, toast } = useApp();
  const patientsRef = useRef(S.patients);
  patientsRef.current = S.patients;

  // ---- local ephemeral view-state (was this.state.cal* in the prototype) ----
  const [calStatus, setCalStatus] = useState<CalStatus>('idle');
  const [calEvents, setCalEvents] = useState<any[]>([]);
  const [calError, setCalError] = useState('');
  const [calLastSync, setCalLastSync] = useState<number | null>(null);
  const [calRefreshing, setCalRefreshing] = useState(false);
  const [calSelectedDay, setCalSelectedDay] = useState<string | null>(null);
  const [calWeekAnchor, setCalWeekAnchor] = useState(() => new Date());
  const calAccount = S.calAccount;
  const apiConnected = isApiConfigured();

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // ---- load (ported from _loadCalendar) ----
  const loadCalendar = useCallback(async (isRefresh: boolean) => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch { /* ignore */ } }
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortRef.current = ac;
    if (isRefresh) setCalRefreshing(true);
    else { setCalStatus('loading'); setCalError(''); }
    try {
      const timeMin = weekStart(calWeekAnchor);
      const timeMax = weekEnd(calWeekAnchor);
      const events = await loadCalendarEvents({
        timeMin,
        timeMax,
        weekAnchor: calWeekAnchor,
        signal: ac ? ac.signal : undefined,
        resolvePatientName: (patientId) => {
          if (!patientId) return undefined;
          const p = patientsRef.current.find((x: any) => x.id === patientId);
          return p?.name;
        },
      });
      if (ac && ac.signal && ac.signal.aborted) return;
      if (!mountedRef.current) return;
      setCalEvents(events);
      setCalStatus(events.length ? 'ready' : 'empty');
      setCalRefreshing(false);
      setCalLastSync(Date.now());
    } catch (err: any) {
      if (err && err.name === 'AbortError') return;
      if (!mountedRef.current) return;
      if (isRefresh) { setCalRefreshing(false); toast('רענון היומן נכשל. מציג את הנתונים האחרונים', 'error'); }
      else { setCalStatus('error'); setCalRefreshing(false); setCalError(err && err.message ? err.message : 'שגיאת רשת'); }
    }
  }, [calWeekAnchor, toast]);

  useEffect(() => {
    mountedRef.current = true;
    loadCalendar(false);
    const poll = setInterval(() => {
      if (mountedRef.current && (typeof document === 'undefined' || !document.hidden)) loadCalendar(true);
    }, 45000);
    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      if (abortRef.current) { try { abortRef.current.abort(); } catch { /* ignore */ } abortRef.current = null; }
    };
  }, [loadCalendar]);

  useEffect(() => {
    if (!(S.calendarRefreshNonce || 0)) return;
    loadCalendar(true);
  }, [S.calendarRefreshNonce, loadCalendar]);

  const refreshCalendar = () => loadCalendar(true);
  const retryCalendar = () => loadCalendar(false);
  const shiftWeek = (delta: number) => {
    setCalWeekAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
    setCalSelectedDay(null);
  };
  const goToday = () => {
    const today = new Date();
    setCalWeekAnchor(today);
    setCalSelectedDay(dayKey(today));
  };
  const onDatePick = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) return;
    const [y, m, d] = v.split('-').map(Number);
    const picked = new Date(y, m - 1, d);
    setCalWeekAnchor(picked);
    setCalSelectedDay(v);
  };
  const openScheduleDialog = () =>
    set({ dialog: 'schedule', apptForm: defaultScheduleForm(S.patientId || S.patients[0]?.id || 'p1'), errors: {} });

  // ---- flags ----
  const calLoading = calStatus === 'loading' || calStatus === 'idle';
  const calReady = calStatus === 'ready';
  const calErrorState = calStatus === 'error';
  const calEmptyState = calStatus === 'empty';
  const calErrorMsg = calError || 'לא הצלחנו לטעון את היומן';
  const calSyncedLabel = relSync(calLastSync);

  // ---- week / day derivations (ported from renderVals) ----
  const now = new Date();
  const wkStart = weekStart(calWeekAnchor);
  const calWeekLabel = formatWeekRange(calWeekAnchor);
  const byDay: Record<string, any[]> = {};
  calEvents.forEach((e) => { const k = dayKey(new Date(e.start)); (byDay[k] = byDay[k] || []).push(e); });
  const todayKey = dayKey(now);
  // default visible day → today; if today is empty, jump to the nearest day this
  // week that has events (keeps the agenda useful on weekends)
  let defaultSel = todayKey;
  if (!(byDay[todayKey] && byDay[todayKey].length)) {
    for (let i = 0; i < 7; i++) { const d = new Date(wkStart); d.setDate(wkStart.getDate() + i); const k = dayKey(d); if (byDay[k] && byDay[k].length) { defaultSel = k; break; } }
  }
  const selKey = calSelectedDay || defaultSel;

  const calWeekStrip = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(wkStart); d.setDate(wkStart.getDate() + i);
    const k = dayKey(d); const cnt = (byDay[k] || []).length;
    const isToday = k === todayKey; const sel = k === selKey;
    return {
      key: k, dl: DAYL[i], dn: String(d.getDate()).padStart(2, '0'), selected: sel,
      countLabel: cnt > 0 ? cnt + ' אירועים' : 'פנוי',
      onClick: () => setCalSelectedDay(k),
      bg: sel ? 'var(--primary)' : 'var(--paper)',
      fg: sel ? 'var(--on-accent)' : (isToday ? 'var(--primary)' : 'var(--text)'),
      sub: sel ? 'rgba(255,255,255,.82)' : 'var(--text-muted)',
      border: sel ? 'var(--primary)' : (isToday ? 'var(--primary-border)' : 'var(--divider)'),
      dotShow: cnt > 0, dotColor: sel ? 'var(--on-accent)' : 'var(--primary)',
    };
  });

  const dayEvents = (byDay[selKey] || []).slice().sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const calAgenda = dayEvents.map((e) => {
    const s = new Date(e.start), en = new Date(e.end);
    const active = s <= now && now < en; const ended = en <= now;
    const st = active
      ? { label: 'מתקיימת כעת', color: 'var(--primary)', bg: 'var(--primary-tint)', dot: 'var(--primary)' }
      : ended
        ? { label: 'הסתיימה', color: 'var(--text-secondary)', bg: 'var(--surface-2)', dot: 'var(--toggle-off)' }
        : { label: 'מתוכננת', color: 'var(--text-secondary)', bg: 'var(--surface-2)', dot: 'var(--primary)' };
    const guest = e.attendees.find((a: any) => !a.self) || e.attendees[0] || null;
    let patientId: string | null = e.patientId ?? null;
    if (!patientId && guest?.name) {
      const match = S.patients.find((p: any) => p.name === guest.name);
      patientId = match?.id ?? null;
    }
    return {
      id: e.id, title: e.title,
      timeLabel: e.allDay ? 'כל היום' : fmt(s), endLabel: e.allDay ? '' : fmt(en),
      initials: guest ? initialsOf(guest.name).toUpperCase() : '•',
      stLabel: st.label, stColor: st.color, stBg: st.bg, lineColor: st.dot,
      metaLine: (e.allDay ? 'אירוע יומי' : fmt(s) + '–' + fmt(en)) + (guest ? ' · ' + guest.name : ''),
      hasLoc: !!e.location, location: e.location, opacity: ended ? '.72' : '1',
      onOpen: () => set({
        dialog: 'calEvent',
        calEventDetail: {
          id: e.id,
          title: e.title,
          description: e.description || '',
          location: e.location || '',
          allDay: e.allDay,
          start: s.toISOString(),
          end: en.toISOString(),
          statusLabel: st.label,
          guestName: guest?.name || '',
          patientId,
        },
      }),
    };
  });
  const calDayEmpty = dayEvents.length === 0;
  const calSelectedTitle = (selKey === todayKey ? 'היום · ' : '') + hebDate(selKey);

  const todaysEv = byDay[todayKey] || [];
  const nextEv = calEvents.map((e) => ({ e, s: new Date(e.start) })).filter((x) => x.s > now).sort((a, b) => +a.s - +b.s)[0];
  const calKpis = [
    { label: 'אירועים היום', value: String(todaysEv.length), color: 'var(--primary)' },
    { label: 'השבוע', value: String(calEvents.length), color: 'var(--text)' },
    { label: 'האירוע הבא', value: nextEv ? fmt(nextEv.s) : '—', color: 'var(--warning)' },
  ];

  const skelBg = 'linear-gradient(90deg,var(--skeleton-1) 25%,var(--skeleton-2) 37%,var(--skeleton-1) 63%)';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>יומן</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: apiConnected ? 'var(--success)' : 'var(--warning)', flexShrink: 0 }}></span>
              {apiConnected ? 'מחובר לשרת' : 'מצב הדגמה · נתוני דוגמה'}
            </span>
            <span style={{ color: 'var(--text-disabled)' }}>·</span>
            <span dir="ltr" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{calWeekLabel}</span>
            {apiConnected && (
              <>
                <span style={{ color: 'var(--text-disabled)' }}>·</span>
                <span dir="ltr" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{calAccount}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span aria-live="polite" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{calSyncedLabel}</span>
          <button
            className="cal-refresh-btn"
            onClick={refreshCalendar}
            disabled={calRefreshing}
            aria-label="רענון היומן"
            title="רענון"
            style={{ width: 44, height: 44, border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', cursor: calRefreshing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: calRefreshing ? 0.6 : 1, flexShrink: 0 }}
          >
            {calRefreshing ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--primary)" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--text-secondary)"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
            )}
          </button>
          <button className="cal-new-btn" onClick={openScheduleDialog} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--paper)"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>פגישה חדשה
          </button>
        </div>
      </div>

      {/* LOADING */}
      {calLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((k) => (
              <div key={k} style={{ height: 94, borderRadius: 10, background: skelBg, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear' }}></div>
            ))}
          </div>
          <div className="rx-kpi4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
            {[1, 2, 3].map((k) => (
              <div key={k} style={{ height: 76, borderRadius: 10, background: skelBg, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear' }}></div>
            ))}
          </div>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, overflow: 'hidden' }}>
            {[1, 2, 3, 4].map((k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '16px 22px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 48, height: 14, borderRadius: 6, background: skelBg, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', flexShrink: 0 }}></div>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: skelBg, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ width: 190, maxWidth: '60%', height: 13, borderRadius: 6, background: skelBg, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear', marginBottom: 8 }}></div>
                  <div style={{ width: 130, maxWidth: '40%', height: 11, borderRadius: 6, background: skelBg, backgroundSize: '760px 100%', animation: 'shimmer 1.4s infinite linear' }}></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ERROR */}
      {calErrorState && (
        <div role="alert" style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, padding: '44px 24px', textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="var(--error)"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>לא הצלחנו לטעון את היומן</h3>
          <p style={{ margin: '0 auto 20px', color: 'var(--text-secondary)', fontSize: 14.5, maxWidth: 420 }}>{calErrorMsg} · בדקו את החיבור ונסו שוב.</p>
          <button className="cal-retry-btn" onClick={retryCalendar} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="var(--paper)"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>נסו שוב
          </button>
        </div>
      )}

      {/* EMPTY / READY — week navigation + agenda */}
      {(calReady || calEmptyState) && (
        <>
          {calReady && calRefreshing && (
            <div style={{ height: 3, borderRadius: 3, overflow: 'hidden', background: 'var(--primary-tint)', marginBottom: 14, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, height: 3, background: 'var(--primary)', width: '55%', animation: 'loadbar 1.1s cubic-bezier(.4,0,.2,1) infinite', borderRadius: '0 3px 3px 0' }}></div>
            </div>
          )}

          {calReady && (
            <div className="rx-kpi4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {calKpis.map((c, i) => (
                <div key={i} style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
                  <div dir="ltr" style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1, textAlign: 'start' }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="cal-week-nav" onClick={() => shiftWeek(-1)} aria-label="שבוע קודם" style={{ height: 40, padding: '0 14px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'inherit' }}>‹ שבוע קודם</button>
              <button type="button" className="cal-today-btn" onClick={goToday} style={{ height: 40, padding: '0 14px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'inherit' }}>היום</button>
              <button type="button" className="cal-week-nav" onClick={() => shiftWeek(1)} aria-label="שבוע הבא" style={{ height: 40, padding: '0 14px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'inherit' }}>שבוע הבא ›</button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)' }}>
              <span>מעבר לתאריך</span>
              <input type="date" className="cal-date-input" value={selKey} onChange={onDatePick} aria-label="בחירת תאריך" style={{ height: 40, border: '1px solid var(--primary-border)', borderRadius: 10, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: 'var(--primary-surface)', color: 'var(--text)' }} />
            </label>
          </div>

          <div className="week-strip" role="tablist" aria-label="ימי השבוע" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10, marginBottom: 20 }}>
            {calWeekStrip.map((d) => (
              <div key={d.key} className="cal-day-cell" onClick={d.onClick} role="tab" tabIndex={0} aria-selected={d.selected} style={{ background: d.bg, border: '1px solid ' + d.border, borderRadius: 10, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s,background .15s' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: d.sub }}>{d.dl}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: d.fg, lineHeight: 1.3 }}>{d.dn}</div>
                <div style={{ fontSize: 10.5, color: d.sub }}>{d.countLabel}</div>
                {d.dotShow && <div style={{ width: 5, height: 5, borderRadius: '50%', background: d.dotColor, margin: '5px auto 0' }}></div>}
              </div>
            ))}
          </div>

          {calEmptyState && (
            <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, padding: '44px 24px', textAlign: 'center', boxShadow: CARD_SHADOW, marginBottom: 20 }}>
              <img src="/assets/sensei-scroll.png" alt="" aria-hidden="true" width={120} height={92} style={{ display: 'block', margin: '0 auto 14px', objectFit: 'contain', opacity: 0.8 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>אין אירועים בשבוע זה</h3>
              <p style={{ margin: '0 auto 18px', color: 'var(--text-secondary)', fontSize: 14.5, maxWidth: 430 }}>לא נמצאו אירועים בטווח {calWeekLabel}.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="cal-empty-refresh" onClick={refreshCalendar} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>רענון</button>
                <button className="cal-empty-new" onClick={openScheduleDialog} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>פגישה חדשה</button>
              </div>
            </div>
          )}

          {calReady && (
          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--bg)' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{calSelectedTitle}</h2>
            </div>
            {calDayEmpty && (
              <div style={{ padding: '40px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 3 }}>אין אירועים ביום זה</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>בחרו יום אחר בשבוע, או קבעו פגישה חדשה כעת.</div>
                <button className="cal-empty-new" onClick={openScheduleDialog} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>פגישה חדשה</button>
              </div>
            )}
            {calAgenda.map((a) => (
              <div key={a.id} className="cal-agenda-row" onClick={a.onOpen} role="button" tabIndex={0} aria-label={a.title} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '15px 22px', borderBottom: '1px solid var(--line)', cursor: 'pointer', borderInlineStart: '3px solid ' + a.lineColor, opacity: Number(a.opacity) }}>
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                  <div dir="ltr" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.3px' }}>{a.timeLabel}</div>
                  <div dir="ltr" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.endLabel}</div>
                </div>
                <div style={{ width: 1, height: 40, background: 'var(--divider)' }}></div>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.metaLine}</span>
                    {a.hasLoc && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" /></svg>{a.location}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: a.stBg, color: a.stColor, whiteSpace: 'nowrap' }}>{a.stLabel}</span>
              </div>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}
