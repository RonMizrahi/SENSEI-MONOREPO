// Mobile day view — the phone home screen (design: "Sensei Mobile Day View").
// A horizontal date strip over a per-day appointment list; each appointment
// expands to quick actions (insight / attach / record) and a prep CTA. Data is
// the same store/services source as the desktop week view (useWeekEvents), so
// the two shells stay in sync. Insight/attach are bottom-sheets; toasts reuse
// the store's Snackbar via useApp().toast.
import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { heGreeting, getPatient, relativeWhen, heCount } from '../../utils';
import { HE_DAYS_SHORT, HE_MONTHS, fmtTime, sameDay } from '../../utils/dates';
import { dashboardStats, openDraftPids } from '../../utils/dashboardStats';
import { dayKey, eventGuestName, weekStart, dbEventApiId, type CalendarUiEvent } from '../../services/calendar';
import { SESSION_CATEGORIES, categoryOf } from '../../data/sessionCategories';
import { useWeekEvents } from '../../hooks/useWeekEvents';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { InsightIcon, AttachIcon, MicIcon, PlusIcon, CloseIcon, SunIcon, CameraIcon, ImageIcon, FolderIcon } from './icons';

type Sheet = { type: 'insight' | 'attach'; pid: string; name: string } | null;

interface Props {
  onOpenRecording?: (pid: string, name: string, meetingId?: string) => void;
}

export default function MobileDayView({ onOpenRecording }: Props = {}) {
  const { S, set, navigate, toast } = useApp();

  const now = new Date();
  const greetWord = heGreeting(now);
  const therapistName = (S.profile && S.profile.name) || '';
  const startCoreFlow = () => navigate('upload', { upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  const dismissTip = () => set({ onboardTipDismissed: true });

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [insightText, setInsightText] = useState('');
  const sheetRef = useFocusTrap<HTMLDivElement>(!!sheet);

  const { events, error: weekError, reload: reloadWeek } = useWeekEvents(selectedDate, S.scheduledAppts || [], S.patients);

  // close the bottom sheet on Escape
  useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const resolvePid = (ev: CalendarUiEvent): string | null =>
    ev.patientId ?? S.patients.find((p: any) => p.name === eventGuestName(ev))?.id ?? null;

  // 14-day strip anchored to the selected date's week, so the strip and the
  // month picker always agree on which day is selected (and the selected day
  // stays visible + highlighted after a month-picker jump).
  const stripStart = weekStart(selectedDate);
  const strip = Array.from({ length: 14 }, (_, i) => { const d = new Date(stripStart); d.setDate(stripStart.getDate() + i); return d; });
  // Meeting-dot indicators for the strip — from the locally-scheduled
  // appointments (the patient-tied truth), so the therapist sees at a glance
  // which days hold meetings instead of tapping day-by-day.
  const apptDays = new Set((S.scheduledAppts || []).map((a: any) => a.date));

  const dayEvents = events
    .filter((e) => !e.allDay && sameDay(new Date(e.start), selectedDate))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  const appts = dayEvents.map((ev) => {
    const pid = resolvePid(ev);
    return {
      key: ev.id,
      pid,
      time: fmtTime(new Date(ev.start)),
      name: eventGuestName(ev),
      kind: SESSION_CATEGORIES[categoryOf(ev.title, ev.description)].label,
    };
  });

  // month picker cells
  const mFirst = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const mDays = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const monthCells: (number | null)[] = [];
  for (let i = 0; i < mFirst.getDay(); i++) monthCells.push(null);
  for (let d = 1; d <= mDays; d++) monthCells.push(d);

  const openPatient = (pid: string | null) => { if (pid) navigate('patient', { patientId: pid }); else navigate('calendar'); };
  const openPrep = (pid: string | null, meetingId?: string) => {
    if (pid) {
      navigate('report', {
        patientId: pid,
        reportMeetingId: meetingId ? dbEventApiId(meetingId) : null,
      });
    } else {
      navigate('calendar');
    }
  };

  // When the selected day is clear, surface the therapist's next upcoming session
  // (across days) so the phone home is never a dead end — parity with the desktop
  // home's "next session" focus. Shares the same dashboardStats source.
  const stats = dashboardStats(S.scheduledAppts, S.patients, now);
  const nextAppt = stats.next;
  // Greeting counts derive from the complete calendar (events = seed fixtures +
  // scheduled), matching the desktop home + the calendar rather than the
  // scheduledAppts-only stats — so today/week never disagree across the app.
  const todaySessions = events.filter((e) => !e.allDay && sameDay(new Date(e.start), now)).length;
  const weekSessions = events.filter((e) => !e.allDay).length;
  const nextPatient = nextAppt ? getPatient(S.patients, nextAppt.pid, S.archivedPatients || []) : null;

  // Compact workload line + resume-draft chip — parity with the desktop summary
  // strip / "resume work" card, sized for a phone. An unsaved note must be just
  // as recoverable from the phone as from the desktop.
  const draftPids = openDraftPids(S.notesDrafts, S.summaryDrafts);
  const firstDraftPatient = draftPids.length ? getPatient(S.patients, draftPids[0], S.archivedPatients || []) : null;

  const saveInsight = () => {
    const name = sheet?.name || '';
    const has = insightText.trim().length > 0;
    setSheet(null);
    setInsightText('');
    if (has) toast('התובנה נשמרה בתיק של ' + name, 'success');
    else toast('לא הוזנה תובנה', 'info');
  };
  const pickAttach = (label: string) => { const name = sheet?.name || ''; setSheet(null); toast(label + ' · צורף לתיק של ' + name, 'success'); };

  const monthTitle = HE_MONTHS[selectedDate.getMonth()] + ' ' + selectedDate.getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* personalized greeting */}
      <div style={{ padding: '12px 16px 0' }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{greetWord}{therapistName ? ', ' + therapistName : ''}</h1>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
          {todaySessions ? heCount(todaySessions, 'פגישה אחת היום', 'פגישות היום') : 'אין פגישות היום'}
          {' · '}
          {heCount(weekSessions, 'פגישה אחת השבוע', 'פגישות השבוע')}
        </p>
        {firstDraftPatient && (
          <button
            type="button"
            className="tap44"
            onClick={() => openPatient(draftPids[0])}
            aria-label={'המשך עריכה · ' + firstDraftPatient.name}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBlockStart: 8, height: 32, padding: '0 12px', border: '1px solid var(--primary-border)', borderRadius: 16, background: 'var(--primary-surface)', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" /></svg>
            {heCount(draftPids.length, 'טיוטה שלא נשמרה', 'טיוטות שלא נשמרו')} · {firstDraftPatient.name}
          </button>
        )}
      </div>

      {/* first-run tip → the core flow (parity with the desktop home) */}
      {!S.onboardTipDismissed && (
        <div role="note" style={{ margin: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', borderRadius: 12, padding: '11px 13px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>ברוכים הבאים לסנסיי</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 2 }}>העלו הקלטה של מפגש כדי לקבל סיכום AI ודוח הכנה לפגישה הבאה.</div>
          </div>
          <button type="button" className="tap44" onClick={startCoreFlow} style={{ height: 34, padding: '0 13px', border: 'none', borderRadius: 9, background: 'var(--primary)', color: 'var(--paper)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>העלאה</button>
          <button type="button" className="tap44" onClick={dismissTip} aria-label="סגירת ההודעה" style={{ width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
            <CloseIcon />
          </button>
        </div>
      )}

      {/* month title + strip */}
      <div style={{ padding: '10px 16px 0' }}>
        <button type="button" className="mob-monthbtn" onClick={() => setMonthOpen((v) => !v)} aria-expanded={monthOpen} aria-label={'בחירת חודש · ' + monthTitle}>
          <span className="mob-month-title">{monthTitle}</span>
          <span aria-hidden style={{ fontSize: 13 }}>▾</span>
        </button>

        {monthOpen && (
          <div className="mob-card" style={{ padding: '12px 14px', margin: '4px 0 10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
              {HE_DAYS_SHORT.map((d, i) => <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {monthCells.map((c, i) => {
                if (c === null) return <div key={i} />;
                const cellDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), c);
                const isSel = sameDay(cellDate, selectedDate);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setSelectedDate(cellDate); setMonthOpen(false); setExpandedId(null); }}
                    aria-label={c + ' ' + HE_MONTHS[selectedDate.getMonth()]}
                    style={{ height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: isSel ? 800 : 500, background: isSel ? 'var(--primary)' : 'transparent', color: isSel ? 'var(--on-accent)' : 'var(--primary)' }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mob-daystrip" role="tablist" aria-label="בחירת יום">
        {strip.map((d, i) => {
          const isSel = sameDay(d, selectedDate);
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={isSel}
              className={'mob-day-btn' + (isSel ? ' is-selected' : '')}
              onClick={() => { setSelectedDate(d); setExpandedId(null); }}
            >
              <span className="mob-day-dow">{HE_DAYS_SHORT[d.getDay()]}</span>
              <span className="mob-day-num">{d.getDate()}</span>
              <span className={'mob-day-dot' + (apptDays.has(dayKey(d)) ? ' has' : '')} aria-hidden="true" />
              {apptDays.has(dayKey(d)) && <span className="sr-only">· יש פגישות</span>}
            </button>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />

      {/* appointment list */}
      <div className="mob-list">
        {weekError && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '10px 0', padding: '10px 12px', background: 'var(--error-bg-soft)', border: '1px solid var(--error-line)', borderRadius: 10 }}>
            <span style={{ flex: 1, minWidth: 150, fontSize: 12.5, fontWeight: 600, color: 'var(--error-dark)' }}>טעינת היומן נכשלה.</span>
            <button type="button" onClick={reloadWeek} style={{ height: 30, padding: '0 12px', border: '1px solid var(--error-border)', borderRadius: 8, background: 'var(--paper)', color: 'var(--error-dark)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>ניסיון חוזר</button>
          </div>
        )}
        {appts.length === 0 ? (
          <div className="mob-empty">
            <SunIcon size={34} />
            <div className="mob-empty-title">אין פגישות ביום זה</div>
            {nextAppt && nextPatient ? (
              <div style={{ width: '100%', marginBlockStart: 18, background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, padding: 14, textAlign: 'start' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.02em', marginBlockEnd: 8 }}>הפגישה הבאה שלך</div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextPatient.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBlockStart: 2 }}>{relativeWhen(nextAppt.when, now)}</div>
                <div style={{ display: 'flex', gap: 8, marginBlockStart: 12 }}>
                  <button type="button" onClick={() => openPatient(nextAppt.pid)} style={{ flex: 1, height: 44, border: '1px solid var(--border-input)', borderRadius: 9, background: 'var(--paper)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>פתיחת התיק</button>
                  <button type="button" onClick={() => openPrep(nextAppt.pid)} style={{ flex: 1, height: 44, border: 'none', borderRadius: 9, background: 'var(--primary)', color: 'var(--paper)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>הכנה לפגישה</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={startCoreFlow} style={{ marginBlockStart: 16, height: 40, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>העלאת הקלטה של מפגש</button>
            )}
          </div>
        ) : appts.map((a) => {
          const open = expandedId === a.key;
          return (
            <div key={a.key} className="mob-appt">
              <div className="mob-appt-head">
                <span className="mob-appt-time" dir="ltr">{a.time}</span>
                <button type="button" className="mob-appt-open" onClick={() => openPatient(a.pid)}>
                  <span className="mob-appt-name">{a.name}</span>
                  <span className="mob-appt-kind">{a.kind}</span>
                </button>
                <button
                  type="button"
                  className={'mob-plus' + (open ? ' is-open' : '')}
                  aria-label={open ? 'סגירת פעולות' : 'פעולות נוספות · ' + a.name}
                  aria-expanded={open}
                  onClick={() => setExpandedId(open ? null : a.key)}
                >
                  {open ? <CloseIcon size={18} /> : <PlusIcon size={18} />}
                </button>
              </div>

              {open && (
                <div className="mob-actions">
                  <button type="button" className="mob-action-btn" aria-label={'תובנה מהירה · ' + a.name} onClick={() => { setInsightText(''); setSheet({ type: 'insight', pid: a.pid || '', name: a.name }); }}>
                    <InsightIcon />
                  </button>
                  <button type="button" className="mob-action-btn" aria-label={'צירוף קובץ · ' + a.name} onClick={() => setSheet({ type: 'attach', pid: a.pid || '', name: a.name })}>
                    <AttachIcon />
                  </button>
                  <button type="button" className="mob-action-btn" aria-label={'הקלטת פגישה · ' + a.name} onClick={() => onOpenRecording?.(a.pid || '', a.name, a.key)}>
                    <MicIcon />
                  </button>
                </div>
              )}

              <button type="button" className="mob-primary-btn" onClick={() => openPrep(a.pid, a.key)}>הכנה לפגישה הבאה</button>
            </div>
          );
        })}
      </div>

      {/* ---- insight sheet ---- */}
      {sheet?.type === 'insight' && (
        <div className="mob-sheet-scrim" onClick={() => setSheet(null)}>
          <div ref={sheetRef} className="mob-sheet" role="dialog" aria-modal="true" aria-label={'תובנה מהירה · ' + sheet.name} onClick={(e) => e.stopPropagation()}>
            <div className="mob-sheet-handle" />
            <div className="mob-sheet-title">תובנה מהירה · {sheet.name}</div>
            <div className="mob-sheet-sub">תתווסף לתיק המטופל ותשוקלל בדוח ההכנה הבא</div>
            <textarea
              className="mob-sheet-textarea"
              placeholder="מה שמתם לב אליו?"
              value={insightText}
              onChange={(e) => setInsightText(e.target.value)}
              aria-label="טקסט התובנה"
              autoFocus
            />
            <button type="button" className="mob-primary-btn" onClick={saveInsight}>שמירת תובנה</button>
          </div>
        </div>
      )}

      {/* ---- attach sheet ---- */}
      {sheet?.type === 'attach' && (
        <div className="mob-sheet-scrim" onClick={() => setSheet(null)}>
          <div ref={sheetRef} className="mob-sheet" role="dialog" aria-modal="true" aria-label={'צירוף קובץ · ' + sheet.name} onClick={(e) => e.stopPropagation()}>
            <div className="mob-sheet-handle" />
            <div className="mob-sheet-title">צירוף קובץ · {sheet.name}</div>
            <button type="button" className="mob-attach-opt" onClick={() => pickAttach('המסמך צולם')}><CameraIcon />צילום מסמך</button>
            <button type="button" className="mob-attach-opt" onClick={() => pickAttach('התמונה נבחרה')}><ImageIcon />בחירה מהתמונות</button>
            <button type="button" className="mob-attach-opt" onClick={() => pickAttach('הקובץ נבחר')}><FolderIcon />עיון בקבצים</button>
          </div>
        </div>
      )}
    </div>
  );
}
