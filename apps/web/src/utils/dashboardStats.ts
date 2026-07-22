// Pure workload/attention math for the home dashboard. Kept in one place so the
// summary strip and the focus zone report the same numbers (no parallel logic),
// and so the counting is unit-testable without mounting the app. All patient-tied
// truth comes from the locally-scheduled appointments — deliberately NOT the
// generic calendar fixture, which is a decorative view-only demo schedule (see
// services/calendar.ts). Takes plain arguments only (no store/data imports) to
// respect the leaf-module layering rule.

export interface UpcomingAppt {
  id: string
  pid: string
  date: string
  time?: string
  description?: string
  when: Date
}

export interface DashboardStats {
  /** appointments whose date is today (past + future today) */
  today: number
  /** appointments falling inside the current Sun–Sat week */
  week: number
  /** future appointments, ascending by time */
  upcoming: UpcomingAppt[]
  /** the earliest future appointment, or null */
  next: UpcomingAppt | null
  /** ids of active patients with no upcoming appointment (follow-ups to schedule) */
  awaitingPids: string[]
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDayKey = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

// Sunday-based week start (the app's calendar begins on ראשון), normalized to 00:00.
function weekStart(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function dashboardStats(scheduledAppts: any[] | undefined, patients: any[] | undefined, now: Date): DashboardStats {
  const appts: UpcomingAppt[] = (scheduledAppts || []).map((a: any) => ({
    ...a,
    when: new Date(a.date + 'T' + (a.time || '00:00')),
  }));

  const ws = weekStart(now);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 7);
  const todayKey = localDayKey(now);

  const today = appts.filter((a) => a.date === todayKey).length;
  const week = appts.filter((a) => a.when >= ws && a.when < we).length;

  const upcoming = appts
    .filter((a) => a.when.getTime() >= now.getTime())
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const withUpcoming = new Set(upcoming.map((a) => a.pid));
  const awaitingPids = (patients || []).filter((p: any) => !withUpcoming.has(p.id)).map((p: any) => p.id);

  return { today, week, upcoming, next: upcoming[0] || null, awaitingPids };
}

// The patients with a non-empty unsaved notes/summary draft (work to resume).
export function openDraftPids(notesDrafts: Record<string, any> | undefined, summaryDrafts: Record<string, any> | undefined): string[] {
  return Array.from(new Set([
    ...Object.keys(notesDrafts || {}),
    ...Object.keys(summaryDrafts || {}),
  ])).filter((pid) => (notesDrafts?.[pid]?.trim?.()) || (summaryDrafts?.[pid]?.trim?.()));
}
