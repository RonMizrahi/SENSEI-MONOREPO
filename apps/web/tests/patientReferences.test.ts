// R-1 regression — referential integrity on PERMANENT delete. A hard-removed
// patient must leave no orphaned references in any pid-keyed collection (an
// orphan appointment would otherwise resolve to patients[0] via the getPatient
// fallback and render as a ghost). purgePatientReferences must be exhaustive,
// idempotent (a no-op on an already-clean id), and must touch only the target id.
import { describe, expect, it } from 'vitest';
import { purgePatientReferences } from '../src/utils/patientReferences';

function fullState() {
  return {
    notesOverrides: { p1: 'a', p2: 'b' },
    notesDrafts: { p1: 'd1', p2: 'd2' },
    overviewOverrides: { p1: {}, p2: {} },
    documentsByPatient: { p1: [{ id: 'x' }], p2: [{ id: 'y' }] },
    summaryEdits: { p1: 's', p2: 's2' },
    summaryDrafts: { p1: 'sd', p2: 'sd2' },
    transcriptsByPatient: { p1: ['t'], p2: ['u'] },
    scheduledAppts: [{ id: 'a1', pid: 'p1' }, { id: 'a2', pid: 'p2' }, { id: 'a3', pid: 'p1' }],
    sessionNotes: { 'p1_1': 'n', 'p1_2': 'n2', 'p2_1': 'm' },
    deletedSessions: ['p1#3', 'p2#1', 'p1#4'],
    recentPatientIds: ['p2', 'p1', 'p3'],
    activeTranscriptPatientId: 'p1',
  };
}

describe('purgePatientReferences — R-1 orphan cleanup', () => {
  it('strips every reference to the deleted id and leaves other patients intact', () => {
    const s = fullState();
    const patch = purgePatientReferences('p1', s);
    const next = { ...s, ...patch };

    // p1 fully purged across every collection
    expect(next.notesOverrides).toEqual({ p2: 'b' });
    expect(next.notesDrafts).toEqual({ p2: 'd2' });
    expect(next.overviewOverrides).toEqual({ p2: {} });
    expect(next.documentsByPatient).toEqual({ p2: [{ id: 'y' }] });
    expect(next.summaryEdits).toEqual({ p2: 's2' });
    expect(next.summaryDrafts).toEqual({ p2: 'sd2' });
    expect(next.transcriptsByPatient).toEqual({ p2: ['u'] });
    expect(next.scheduledAppts).toEqual([{ id: 'a2', pid: 'p2' }]);
    expect(next.sessionNotes).toEqual({ 'p2_1': 'm' });
    expect(next.deletedSessions).toEqual(['p2#1']);
    expect(next.recentPatientIds).toEqual(['p2', 'p3']);
    expect(next.activeTranscriptPatientId).toBe(null);

    // no dangling reference to p1 anywhere
    expect(JSON.stringify(next)).not.toContain('p1');
  });

  it('is idempotent — re-running on an already-clean id is a no-op', () => {
    const s = fullState();
    const cleaned = { ...s, ...purgePatientReferences('p1', s) };
    const secondPass = purgePatientReferences('p1', cleaned);
    expect(secondPass).toEqual({});
  });

  it('returns an empty patch for an unknown id (only changed slices are emitted)', () => {
    expect(purgePatientReferences('nope', fullState())).toEqual({});
  });

  it('ignores a partial id (p1 must not purge p10 / p1_x lookalikes)', () => {
    const s = { ...fullState(), notesOverrides: { p1: 'a', p10: 'keep' }, scheduledAppts: [{ id: 'a', pid: 'p10' }] };
    const next = { ...s, ...purgePatientReferences('p1', s) };
    expect(next.notesOverrides).toEqual({ p10: 'keep' });
    expect(next.scheduledAppts).toEqual([{ id: 'a', pid: 'p10' }]);
  });

  it('handles empty/absent collections without throwing', () => {
    expect(purgePatientReferences('p1', {})).toEqual({});
    expect(purgePatientReferences('', fullState())).toEqual({});
  });
});
