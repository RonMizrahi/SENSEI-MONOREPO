// Shared pure helpers — ported verbatim from the prototype logic class.
import { HE_DAYS, fmtDayMonth, fmtTime } from './dates';

export interface RiskMeta { label: string; color: string; bg: string }

export function riskMeta(r: string): RiskMeta {
  if (r === 'high') return { label: 'סיכון גבוה', color: 'var(--error)', bg: 'var(--error-bg)' };
  if (r === 'medium') return { label: 'סיכון בינוני', color: 'var(--warning)', bg: 'var(--warning-bg)' };
  if (r === 'low') return { label: 'סיכון נמוך', color: 'var(--success)', bg: 'var(--success-bg)' };
  return { label: 'יציב', color: 'var(--text-secondary)', bg: 'var(--surface-2)' };
}

// The design system's avatar scale — the ONLY sanctioned raw hex outside
// styles/tokens.css. Raw hex (not var(--token)) because avatarColors() below
// derives the tint background ('33'/'22' alpha suffix) and the dark-mode
// initials (lighten()) arithmetically, which CSS variables can't feed.
// All eight are the system's blue/navy family; identical in both themes.
// The canonical-guard ratchet counts these eight and nothing else.
export const AVATAR_PALETTE = [
  '#1F63D6', '#2E6BA8', '#0E3C88', '#2C74C6', '#1450B4', '#3A6EA5', '#2A5DA0', '#164FB0',
];

// Lift a hex toward white by `amt` (0..1) — keeps the hue, raises luminance.
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt).toString(16).padStart(2, '0');
  return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
}

// Per-patient avatar tint. Theme-aware (the one non-pure helper here): in light mode
// a 13% tint bg + saturated initials reads well, but in dark mode that same-hue pair
// collapses to ~1.5–2.6:1, so we deepen the tint and lift the initials toward white —
// restoring WCAG AA while keeping each patient's hue.
export function avatarColors(c?: string): { bg: string; color: string } {
  if (!c || c.startsWith('var(')) return { bg: 'var(--primary-tint)', color: 'var(--primary)' };
  const dark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
  if (dark) return { bg: c + '33', color: lighten(c, 0.55) };
  return { bg: c + '22', color: c };
}

// Canonical email-format check — the ONE regex for every email validation
// (login, registration, password reset, profile). Consolidates what were three
// different patterns (two lenient, one strict) into the strict form.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hebrew count label: the number 1 takes a singular noun ("פגישה אחת"), not a
// plural one ("1 פגישות"). Returns the singular phrase for 1, else "N <plural>".
export function heCount(n: number, one: string, many: string): string {
  return n === 1 ? one : n + ' ' + many;
}

// Time-aware Hebrew greeting for the workspace header. Single source used by the
// desktop and mobile home so the two shells stay consistent.
export function heGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 15) return 'צהריים טובים';
  if (h < 18) return 'אחר צהריים טובים';
  return 'ערב טוב';
}

// Relative day/time phrase for an upcoming moment ("היום · 14:00", "מחר · 09:00",
// "יום ג׳ · 11:00", else "DD/MM · HH:MM"). Natural, scannable Hebrew.
export function relativeWhen(when: Date, now: Date = new Date()): string {
  const time = fmtTime(when);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(when) - startOf(now)) / 86400000);
  if (days === 0) return 'היום · ' + time;
  if (days === 1) return 'מחר · ' + time;
  if (days > 1 && days < 7) return 'יום ' + HE_DAYS[when.getDay()] + ' · ' + time;
  return fmtDayMonth(when) + ' · ' + time;
}

// Israeli phone: forgiving on separators (hyphens/spaces/parens), strict on the
// digit count — 9 (landline 0X-XXXXXXX) or 10 (mobile 05X-XXXXXXX), or +972.
// Rejects "5"/"abc" without over-restricting real formats.
export function isValidPhone(raw: string): boolean {
  const s = (raw || '').trim();
  if (!s) return false;
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+') || digits.startsWith('972')) {
    // +972-5X-XXXXXXX → 972 + 9 digits
    return digits.startsWith('972') && digits.length >= 11 && digits.length <= 12;
  }
  return /^0[2-9]\d{7,8}$/.test(digits);
}

// File upload validation — MP3 / WAV / M4A / recorded WebM·OGG by extension (GOVERNANCE §12).
export const SUPPORTED_FORMATS = /\.(mp3|wav|m4a|webm|ogg)$/i;

export function validateFile(name: string): boolean {
  return SUPPORTED_FORMATS.test(name || '');
}

// Merge demo fixture appointments with user-scheduled ones. Scheduled entries
// override fixtures at the same patient+time; each row gets a stable id for React keys.
export function mergeAppointments<T extends { id?: string; pid: string; time: string }>(
  base: T[],
  scheduled: T[],
): (T & { id: string })[] {
  const map = new Map<string, T & { id: string }>();
  for (const a of base) {
    const key = `${a.pid}@${a.time}`;
    map.set(key, { ...a, id: a.id ?? `fix-${a.pid}-${a.time.replace(':', '')}` });
  }
  for (const a of scheduled) {
    const key = `${a.pid}@${a.time}`;
    map.set(key, { ...a, id: a.id ?? `legacy-${a.pid}-${a.time.replace(':', '')}` });
  }
  return [...map.values()];
}

export function findPatient(patients: any[], id: string) {
  if (!id) return undefined;
  return patients.find((p) => p.id === id);
}

export function getPatient(patients: any[], id: string, archivedPatients: any[] = []) {
  return (
    findPatient(patients, id) ||
    findPatient(archivedPatients, id) ||
    patients[0] || {
      id: '', name: '—', phone: '—', email: null, created_at: '',
    }
  );
}

// Recently-viewed id list, most-recent-first: move-to-front, de-duplicated, capped.
// Deterministic — re-viewing the patient already at the front is a no-op — so it is
// safe to call on every navigation. Powers the palette's "מטופלים אחרונים" section.
export function pushRecent(list: string[] | undefined, id: string, cap = 6): string[] {
  const prev = Array.isArray(list) ? list : [];
  if (!id) return prev;
  return [id, ...prev.filter((x) => x !== id)].slice(0, cap);
}

// Gendered Hebrew microcopy — provided by /hebrew-grammar.js (window.HG).
export function hg(tpl: string, gender?: string): string {
  const HG = (window as any).HG;
  return HG && HG.fill ? HG.fill(tpl, gender) : tpl;
}

// Gendered dictionary term (patient/therapist/…). Guarded like hg(): if the
// grammar layer failed to load, fall back to the raw term instead of crashing.
export function hgTerm(term: string, gender?: string, opts?: any): string {
  const HG = (window as any).HG;
  return HG && HG.term ? HG.term(term, gender, opts) : term;
}
