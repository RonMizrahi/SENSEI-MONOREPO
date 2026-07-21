// Home "at-a-glance" workload strip — a calm, glanceable row that answers
// "how heavy is my day/week, and what's waiting on me?" above the calendar.
// Reuses the shared dashboardStats/openDraftPids helpers so its numbers always
// match the focus zone. Today + this-week are always shown; drafts and
// follow-ups-to-schedule appear only when there is something to act on, and the
// follow-ups pill is the one actionable tile (→ the patients list).
import { useApp } from '../store/AppStore';
import { dashboardStats, openDraftPids } from '../utils/dashboardStats';
import { heCount } from '../utils';

interface Pill {
  key: string
  value: number
  label: string
  icon: JSX.Element
  onClick?: () => void
  actionLabel?: string
}

const calIcon = <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />;
const weekIcon = <path d="M4 5h16a1 1 0 0 1 1 1v2H3V6a1 1 0 0 1 1-1zm-1 5h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9zm3 2v2h2v-2H6zm5 0v2h2v-2h-2zm5 0v2h2v-2h-2z" />;
const draftIcon = <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 13h8v2H8v-2zm0 3h5v2H8v-2z" />;
const bellIcon = <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />;

// `todayCount`/`weekCount` let the caller supply the counts from the SAME complete
// calendar source the grid + greeting use (weekEvents = seed fixtures + scheduled),
// so the workload strip never disagrees with the calendar. They fall back to the
// scheduledAppts-only dashboardStats when not provided.
export default function DashboardSummary({ todayCount, weekCount }: { todayCount?: number; weekCount?: number } = {}) {
  const { S, navigate } = useApp();
  const now = new Date();
  const stats = dashboardStats(S.scheduledAppts, S.patients, now);
  const draftCount = openDraftPids(S.notesDrafts, S.summaryDrafts).length;
  const awaiting = stats.awaitingPids.length;
  const today = todayCount ?? stats.today;
  const week = weekCount ?? stats.week;

  const pills: Pill[] = [
    { key: 'today', value: today, label: today ? heCount(today, 'פגישה היום', 'פגישות היום') : 'פגישות היום', icon: calIcon },
    { key: 'week', value: week, label: 'פגישות השבוע', icon: weekIcon },
  ];
  if (draftCount > 0) {
    pills.push({ key: 'drafts', value: draftCount, label: heCount(draftCount, 'טיוטה פתוחה', 'טיוטות פתוחות'), icon: draftIcon });
  }
  if (awaiting > 0) {
    pills.push({
      key: 'awaiting', value: awaiting, label: heCount(awaiting, 'מטופל ללא פגישה', 'מטופלים ללא פגישה'),
      icon: bellIcon, onClick: () => navigate('patients'), actionLabel: 'מעבר לרשימת המטופלים לתיאום פגישה',
    });
  }

  return (
    <section aria-label="סיכום היום" className="dash-summary">
      {pills.map((p) => {
        const inner = (
          <>
            <span className="dash-summary-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">{p.icon}</svg>
            </span>
            <span className="dash-summary-text">
              <span className="dash-summary-value">{p.value}</span>
              <span className="dash-summary-label">{p.label}</span>
            </span>
          </>
        );
        return p.onClick ? (
          <button key={p.key} type="button" className="dash-summary-pill dash-summary-pill--action" onClick={p.onClick} aria-label={p.value + ' · ' + p.label + ' · ' + (p.actionLabel || '')}>
            {inner}
            <svg className="dash-summary-chev" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
          </button>
        ) : (
          <div key={p.key} className="dash-summary-pill">{inner}</div>
        );
      })}
    </section>
  );
}
