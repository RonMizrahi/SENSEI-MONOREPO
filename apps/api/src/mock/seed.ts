import { AUTH_TYPE_PASSWORD, ROLE_THERAPIST, TEST_USER } from '../auth/auth.constants';

/**
 * Shared MOCK_MODE seed world (foundation-frozen) — mirrors the frontend's demo
 * data so the SPA lights up against the mock API with familiar content.
 * Workers import these constants into their module's mock repositories.
 */

export interface SeedUser {
  id: string;
  authType: string;
  role: string;
  email: string;
  fullName: string;
  /** Plain password — mock repos hash it at construction time. */
  password: string;
  tokenVersion: number;
}

/** The demo therapist the frontend auto-registers/logs in with. */
export const SEED_USER: SeedUser = {
  id: TEST_USER.userId,
  authType: AUTH_TYPE_PASSWORD,
  role: ROLE_THERAPIST,
  email: TEST_USER.email,
  fullName: TEST_USER.fullName ?? '',
  password: 'demo1234',
  tokenVersion: 0,
};

export interface SeedPatient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  archived: boolean;
  createdAt: string;
}

/** Demo roster — parity with the frontend's MOCK_PATIENTS (p1–p4). */
export const SEED_PATIENTS: SeedPatient[] = [
  {
    id: '00000000-0000-4000-8000-0000000000a1',
    name: 'דנה לוי',
    phone: '054-1234567',
    email: 'dana.l@mail.com',
    archived: false,
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a2',
    name: 'יוסי מזרחי',
    phone: '052-7654321',
    email: 'yossi.m@mail.com',
    archived: false,
    createdAt: '2024-09-01T10:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a3',
    name: 'מיכל כהן',
    phone: '053-9988776',
    email: 'michal.c@mail.com',
    archived: false,
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a4',
    name: 'אבי פרץ',
    phone: '054-3322110',
    email: 'avi.p@mail.com',
    archived: false,
    createdAt: '2024-06-01T10:00:00Z',
  },
];

export interface SeedEvent {
  id: string;
  title: string;
  description: string | null;
  /** Days from "now" at construction time (mock repos materialize real dates). */
  dayOffset: number;
  startHour: number;
  durationMinutes: number;
  patientId: string | null;
}

/** A working week of therapy meetings across the demo roster. */
export const SEED_EVENTS: SeedEvent[] = [
  { id: '00000000-0000-4000-8000-0000000000e1', title: 'פגישה שבועית — דנה לוי', description: null, dayOffset: 0, startHour: 10, durationMinutes: 50, patientId: SEED_PATIENTS[0].id },
  { id: '00000000-0000-4000-8000-0000000000e2', title: 'מעקב — יוסי מזרחי', description: null, dayOffset: 0, startHour: 12, durationMinutes: 50, patientId: SEED_PATIENTS[1].id },
  { id: '00000000-0000-4000-8000-0000000000e3', title: 'פגישת היכרות — מיכל כהן', description: 'פגישה ראשונה', dayOffset: 1, startHour: 9, durationMinutes: 50, patientId: SEED_PATIENTS[2].id },
  { id: '00000000-0000-4000-8000-0000000000e4', title: 'פגישה שבועית — אבי פרץ', description: null, dayOffset: 2, startHour: 16, durationMinutes: 50, patientId: SEED_PATIENTS[3].id },
  { id: '00000000-0000-4000-8000-0000000000e5', title: 'פגישה שבועית — דנה לוי', description: null, dayOffset: 7, startHour: 10, durationMinutes: 50, patientId: SEED_PATIENTS[0].id },
];

/** Canned Hebrew clinical summary served by mock summarizers. */
export const SEED_SUMMARY_TEXT = [
  'נושאים מרכזיים: התמודדות עם לחץ בעבודה ושיפור בדפוסי השינה.',
  'התערבויות המטפל/ת: תרגול נשימות והבניית סדר יום.',
  'סימני סיכון: לא עלו סימני סיכון מפורשים.',
  'המשך ומעקב: תרגול יומי של הטכניקות שנלמדו ומעקב בפגישה הבאה.',
].join('\n');

/** Model tag reported by mock AI providers. */
export const SEED_MOCK_MODEL = 'mock';
