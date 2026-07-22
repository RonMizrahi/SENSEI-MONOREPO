// Shared patient session history — demo roster + handlers for patient / history screens.
import { riskMeta } from './index';
import { SESSION_DATES, sessionSummaries, sessionRisk } from '../data/sessions';
import { PATIENT_SESSION_CONTENT } from '../data/patientSessionContent';

type SessionPatient = { id: string; name?: string; sessions?: number };

export interface PatientSessionBase {
  num: number
  key: string
  date: string
  duration: string
  summary: string
  riskChips: { label: string; color: string; bg: string }[]
  topRiskLabel: string
  topRiskColor: string
  topRiskBg: string
  onSummary: () => void
  onTranscript: () => void
  onOpen: () => void
  onDelete: (e?: { stopPropagation?: () => void }) => void
}

/** Deterministic demo session count per patient (6–10, or a bespoke arc's length). */
export function demoSessionCount(p: { id: string; sessions?: number }): number {
  const bespoke = PATIENT_SESSION_CONTENT[p.id];
  if (bespoke) return Math.min(bespoke.summaries.length, SESSION_DATES.length);
  if (typeof p.sessions === 'number' && p.sessions > 0) {
    return Math.min(p.sessions, SESSION_DATES.length);
  }
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  return Math.min(6 + (h % 5), SESSION_DATES.length);
}

export function buildPatientSessions(
  p: SessionPatient,
  deleted: string[],
  ctx: { navigate: (route: string, patch?: Record<string, unknown>) => void; set: (patch: Record<string, unknown>) => void },
  opts?: { limit?: number },
): PatientSessionBase[] {
  const total = demoSessionCount(p);
  const dates = SESSION_DATES;
  const summaries = sessionSummaries(p);
  const riskByIndex = sessionRisk(p);
  const out: PatientSessionBase[] = [];
  for (let i = 0; i < total; i++) {
    const num = total - i;
    const key = p.id + '#' + num;
    if (deleted.indexOf(key) !== -1) continue;
    const rk = riskByIndex[i];
    const rm = riskMeta(rk);
    out.push({
      num,
      key,
      date: dates[i],
      duration: (45 + (num % 4) * 4) + ' דק׳',
      summary: summaries[i % summaries.length],
      riskChips: rk === 'none' ? [] : [{ label: rm.label, color: rm.color, bg: rm.bg }],
      topRiskLabel: rm.label,
      topRiskColor: rm.color,
      topRiskBg: rm.bg,
      onSummary: () => ctx.navigate('summary', { patientId: p.id }),
      onTranscript: () => ctx.navigate('transcript', { patientId: p.id }),
      onOpen: () => ctx.navigate('session', { patientId: p.id, sessionNum: num }),
      onDelete: (e?: { stopPropagation?: () => void }) => {
        e?.stopPropagation?.();
        ctx.set({
          dialog: 'delSession',
          dialogSessionLabel: 'פגישה ' + num + ' · ' + (p.name || ''),
          dialogSessionKey: key,
        });
      },
    });
  }
  return opts?.limit != null ? out.slice(0, opts.limit) : out;
}

export function enrichPatientSessions(
  baseSessions: PatientSessionBase[],
  S: any,
  patientId: string,
) {
  return baseSessions.map((s) => ({
    ...s,
    hasNote: !!(S.sessionNotes[patientId + '_' + s.num]),
  }));
}
