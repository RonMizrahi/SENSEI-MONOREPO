// Mobile day view — the phone home screen (design: "Sensei Mobile Day View").
// A horizontal date strip over a per-day appointment list; each appointment
// expands to quick actions (insight / attach / record) and a prep CTA. Data is
// the same store/services source as the desktop week view (useWeekEvents), so
// the two shells stay in sync. Insight/attach are bottom-sheets; toasts reuse
// the store's Snackbar via useApp().toast.
import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { eventGuestName, weekStart, type CalendarUiEvent } from '../../services/calendar';
import { SESSION_CATEGORIES, categoryOf } from '../../data/sessionCategories';
import { useWeekEvents } from '../../hooks/useWeekEvents';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { InsightIcon, AttachIcon, MicIcon, PlusIcon, CloseIcon, SunIcon, CameraIcon, ImageIcon, FolderIcon } from './icons';

const HE_DOW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const fmtTime = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type Sheet = { type: 'insight' | 'attach'; pid: string; name: string } | null;

interface Props {
  onOpenRecording: (pid: string, name: string, meetingId?: string) => void;
}

export default function MobileDayView({ onOpenRecording }: Props) {
  const { S, navigate, toast } = useApp();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [insightText, setInsightText] = useState('');
  const sheetRef = useFocusTrap<HTMLDivElement>(!!sheet);

  const { events } = useWeekEvents(selectedDate, S.scheduledAppts || [], S.patients);

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
  const openPrep = (pid: string | null) => { if (pid) navigate('nextMeetingReport', { patientId: pid }); else navigate('calendar'); };

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
      {/* month title + strip */}
      <div style={{ padding: '10px 16px 0' }}>
        <button type="button" className="mob-monthbtn" onClick={() => setMonthOpen((v) => !v)} aria-expanded={monthOpen} aria-label={'בחירת חודש · ' + monthTitle}>
          <span className="mob-month-title">{monthTitle}</span>
          <span aria-hidden style={{ fontSize: 13 }}>▾</span>
        </button>

        {monthOpen && (
          <div className="mob-card" style={{ padding: '12px 14px', margin: '4px 0 10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
              {HE_DOW.map((d, i) => <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{d}</div>)}
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
              <span className="mob-day-dow">{HE_DOW[d.getDay()]}</span>
              <span className="mob-day-num">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />

      {/* appointment list */}
      <div className="mob-list">
        {appts.length === 0 ? (
          <div className="mob-empty">
            <SunIcon size={34} />
            <div className="mob-empty-title">אין פגישות ביום זה</div>
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
                  <button type="button" className="mob-action-btn" aria-label={'הקלטת פגישה · ' + a.name} onClick={() => onOpenRecording(a.pid || '', a.name, a.key)}>
                    <MicIcon />
                  </button>
                </div>
              )}

              <button type="button" className="mob-primary-btn" onClick={() => openPrep(a.pid)}>הכנה לפגישה הבאה</button>
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
