// Referential-integrity helper: remove every reference to a patient id across the
// pid-keyed collections. Used on PERMANENT delete so a hard-removed patient never
// leaves orphans (e.g. ghost appointments that would otherwise resolve to
// patients[0]). Pure, deterministic, and idempotent — running it again on an
// already-clean id returns an empty patch (no change). Returns only the slices
// that actually changed, so the store update stays minimal.

// Object collections keyed directly by patient id.
const PID_KEYED_OBJECTS = [
  'notesOverrides', 'notesDrafts', 'therapistNotes', 'overviewOverrides', 'documentsByPatient',
  'summaryEdits', 'summaryDrafts', 'transcriptsByPatient',
] as const;

export function purgePatientReferences(pid: string, s: Record<string, any>): Record<string, any> {
  const patch: Record<string, any> = {};
  if (!pid) return patch;

  for (const key of PID_KEYED_OBJECTS) {
    const obj = s[key];
    if (obj && Object.prototype.hasOwnProperty.call(obj, pid)) {
      const next = { ...obj };
      delete next[pid];
      patch[key] = next;
    }
  }

  // scheduledAppts — array of records with a `pid` field.
  if (Array.isArray(s.scheduledAppts) && s.scheduledAppts.some((a: any) => a.pid === pid)) {
    patch.scheduledAppts = s.scheduledAppts.filter((a: any) => a.pid !== pid);
  }

  // sessionNotes — object keyed by `${pid}_${sessionNum}`.
  if (s.sessionNotes && Object.keys(s.sessionNotes).some((k) => k.startsWith(pid + '_'))) {
    const next = { ...s.sessionNotes };
    Object.keys(next).forEach((k) => { if (k.startsWith(pid + '_')) delete next[k]; });
    patch.sessionNotes = next;
  }

  // deletedSessions — array of `${pid}#${sessionNum}` keys.
  if (Array.isArray(s.deletedSessions) && s.deletedSessions.some((x: any) => String(x).startsWith(pid + '#'))) {
    patch.deletedSessions = s.deletedSessions.filter((x: any) => !String(x).startsWith(pid + '#'));
  }

  // recentPatientIds — array of ids.
  if (Array.isArray(s.recentPatientIds) && s.recentPatientIds.includes(pid)) {
    patch.recentPatientIds = s.recentPatientIds.filter((x: any) => x !== pid);
  }

  // activeTranscriptPatientId — scalar pointer.
  if (s.activeTranscriptPatientId === pid) patch.activeTranscriptPatientId = null;

  return patch;
}
