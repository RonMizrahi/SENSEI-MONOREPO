// Offline demo roster — used only when VITE_API_BASE_URL is unset.
import type { Patient } from '../services/patients';
import { dayKey } from '../services/calendar';

export interface MockScheduledAppt {
  id: string
  pid: string
  date: string
  time: string
  dur: number
  description: string
}

export const MOCK_PATIENTS: Patient[] = [
  { id: 'p1', name: 'דנה לוי', phone: '054-1234567', email: 'dana.l@mail.com', created_at: '2025-01-15T10:00:00Z' },
  { id: 'p2', name: 'יוסי מזרחי', phone: '052-7654321', email: 'yossi.m@mail.com', created_at: '2024-09-01T10:00:00Z' },
  { id: 'p3', name: 'מיכל כהן', phone: '053-9988776', email: 'michal.c@mail.com', created_at: '2026-02-01T10:00:00Z' },
  { id: 'p4', name: 'אבי פרץ', phone: '054-3322110', email: 'avi.p@mail.com', created_at: '2024-06-01T10:00:00Z' },
];

/** Upcoming local appointments for the offline demo roster (p1–p4). */
export function buildMockScheduledAppts(now = new Date()): MockScheduledAppt[] {
  const slots: Array<{ pid: string; dayOffset: number; time: string; description: string }> = [
    { pid: 'p1', dayOffset: 1, time: '09:00', description: 'פגישה שבועית' },
    { pid: 'p1', dayOffset: 8, time: '13:00', description: 'פגישת מעקב' },
    { pid: 'p2', dayOffset: 2, time: '10:00', description: 'פגישה שבועית' },
    { pid: 'p2', dayOffset: 9, time: '15:00', description: 'פגישת מעקב' },
    { pid: 'p3', dayOffset: 3, time: '11:00', description: 'פגישה שבועית' },
    { pid: 'p3', dayOffset: 10, time: '09:30', description: 'פגישת וידאו' },
    { pid: 'p4', dayOffset: 4, time: '12:00', description: 'פגישת מעקב' },
    { pid: 'p4', dayOffset: 11, time: '16:00', description: 'פגישה שבועית' },
  ];
  return slots.map((slot, index) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + slot.dayOffset);
    return {
      id: 'mock-appt-' + (index + 1),
      pid: slot.pid,
      date: dayKey(d),
      time: slot.time,
      dur: 50,
      description: slot.description,
    };
  });
}
