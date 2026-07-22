// Bespoke per-patient session content (the Simba/p5 arc) must override the
// generic seed arrays, while every other patient keeps the shared content.
import { describe, expect, it } from 'vitest';

describe('treatment arc data (dataset "מפת התהליך")', () => {
  it('p5 phases read chronologically as the dataset arc: ייצוב → … → אינטגרציה', () => {
    // stored newest-first; chronological = reversed indexes (5 sessions)
    const chrono = Array.from({ length: 5 }, (_, i) => sessionMeta({ id: 'p5' }, 4 - i)?.phase);
    expect(chrono[0]).toBe('ייצוב');
    expect(chrono[4]).toBe('אינטגרציה');
    expect(chrono).toHaveLength(5);
    expect(chrono.every(Boolean)).toBe(true);
  });

  it('patients without per-session content have no arc (sessionMeta null — no fabricated arcs)', () => {
    expect(sessionMeta({ id: 'p1' }, 0)).toBeNull();
  });

  it('p5 exposes the dataset core-belief trajectory, earliest → latest; others do not', () => {
    const t = beliefTrajectory({ id: 'p5' });
    expect(t).toBeTruthy();
    expect(t![0]).toContain('הרגתי את אבא');
    expect(t![t!.length - 1]).toContain('צלק ניצל');
    expect(beliefTrajectory({ id: 'p1' }), 'no fabricated trajectories').toBeNull();
  });
});
import { demoSessionCount } from '../src/utils/patientSessions';
import { sessionSummaries } from '../src/data/sessions';
import { beliefTrajectory, sessionInsight, sessionMeta, sessionTitle } from '../src/data/sessionDetail';
import { PATIENT_SESSION_CONTENT } from '../src/data/patientSessionContent';

describe('per-patient bespoke session content', () => {
  it('Simba (p5) gets exactly his 5 bespoke sessions', () => {
    const simba = { id: 'p5', name: 'סימבה' };
    expect(demoSessionCount(simba)).toBe(5);
    expect(sessionSummaries(simba)).toHaveLength(5);
  });

  it('Simba content is his real arc (summary + therapist note as insight + title)', () => {
    const simba = { id: 'p5' };
    // most-recent-first: index 0 is the final integration session
    expect(sessionTitle(simba, 0)).toContain('אינטגרציה');
    expect(sessionSummaries(simba)[0]).toContain('אינטגרציה');
    expect(sessionInsight(simba, 4)).toBeTruthy();
    // arrays are aligned and complete
    expect(PATIENT_SESSION_CONTENT.p5.summaries).toHaveLength(5);
    expect(PATIENT_SESSION_CONTENT.p5.insights).toHaveLength(5);
    expect(PATIENT_SESSION_CONTENT.p5.titles).toHaveLength(5);
  });

  it('a generic patient still shares the neutral content (no bespoke override)', () => {
    const generic = { id: 'p1', name: 'דנה לוי' };
    expect(sessionTitle(generic, 0)).toBe('');
    expect(sessionSummaries(generic).length).toBeGreaterThan(5);
    expect(sessionMeta(generic, 0)).toBeNull();
  });

  it('Simba carries the richer v3 metadata (phase / protocol / distress / homework)', () => {
    const simba = { id: 'p5' };
    const m = sessionMeta(simba, 0); // latest = integration session
    expect(m).not.toBeNull();
    expect(m!.phase).toContain('אינטגרציה');
    expect(m!.protocol).toBeTruthy();
    expect(m!.distress).toBeTruthy();
    expect(m!.homework).toBeTruthy();
    expect(m!.focus).toBeTruthy();
    expect(m!.interventions.length).toBeGreaterThan(0); // parsed into a list
    // the earliest session (index 4) is the stabilization/assessment one
    const first = sessionMeta(simba, 4)!;
    expect(first.phase).toContain('ייצוב');
    expect(first.interventions).toContain('חוזה טיפולי');
    // patient_state is present on sessions 1 (index 4) and 5 (index 0), empty otherwise
    expect(first.patientState).toContain('עוררות יתר');
    expect(m!.patientState).toContain('יציבה זקופה');
    expect(sessionMeta(simba, 2)!.patientState).toBe('');
  });

  it('no em dash sits adjacent to Hebrew in the bespoke content (house style)', () => {
    const all = [
      ...PATIENT_SESSION_CONTENT.p5.summaries,
      ...PATIENT_SESSION_CONTENT.p5.insights,
      ...PATIENT_SESSION_CONTENT.p5.titles,
    ].join('\n');
    expect(/[א-ת].{0,2}—|—.{0,2}[א-ת]/.test(all)).toBe(false);
  });
});
