// Canonical Hebrew calendar names + tiny date helpers. Consolidated from
// per-file copies (DashboardPage, MobileDayView, CalendarPage, utils/index,
// UpcomingMeetingList) so day/month naming and time formatting can never drift
// between the desktop and mobile shells. Leaf module · no app imports.

/** Full weekday names, Sunday-first (ראשון…שבת). */
export const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** Single-letter weekday initials, Sunday-first (א…ש) · calendar column headers. */
export const HE_DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/** Month names in title form (ינואר…דצמבר) · headings like "יולי 2026". */
export const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

/** Month names in "in-month" form (בינואר…בדצמבר) · dates like "21 ביולי 2026". */
export const HE_MONTHS_IN = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];

/** 24h HH:MM (rendered dir="ltr" in the UI). */
export const fmtTime = (d: Date): string =>
  String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** Same calendar day (local time). */
export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Canonical numeric date, DD/MM/YY (e.g. 12/09/26) — the app-wide format. */
export const fmtDate = (d: Date): string =>
  String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear() % 100).padStart(2, '0');

/** Day + month only, DD/MM (e.g. 12/09) — for compact contexts with no year. */
export const fmtDayMonth = (d: Date): string =>
  String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
