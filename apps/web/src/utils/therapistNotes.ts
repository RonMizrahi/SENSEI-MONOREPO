// Therapist between-session notes (spec 3.6) — a dated, append-only timeline per
// patient, replacing the former single free-text blob. Pure helpers so the derive/
// migrate/append/remove logic is unit-testable and has one home (no store/data
// imports — leaf-module layering).
//
// Migration is non-destructive: the legacy `notesOverrides[pid]` string is surfaced
// as a single dated-less "legacy" entry (stable id) until the therapist edits, at
// which point it is materialized into the timeline array alongside new entries.

export interface NoteEntry {
  id: string
  text: string
  at: string | null // ISO timestamp; null for a migrated legacy blob (no known date)
}

export function legacyNoteId(pid: string): string {
  return 'legacy-' + pid;
}

// The timeline to display: the stored array if present, else a one-item fallback
// derived from the legacy blob, else empty. Never mutates its inputs.
export function deriveNotes(
  therapistNotes: Record<string, NoteEntry[]> | undefined,
  notesOverrides: Record<string, string> | undefined,
  pid: string,
): NoteEntry[] {
  const stored = therapistNotes?.[pid];
  if (Array.isArray(stored)) return stored;
  const blob = notesOverrides?.[pid];
  if (typeof blob === 'string' && blob.trim() !== '') {
    return [{ id: legacyNoteId(pid), text: blob, at: null }];
  }
  return [];
}

// Prepend a new entry (newest-first). Caller supplies id + at so the helper stays
// pure/deterministic and testable.
export function addNote(entries: NoteEntry[], text: string, at: string, id: string): NoteEntry[] {
  const t = text.trim();
  if (!t) return entries;
  return [{ id, text: t, at }, ...entries];
}

export function removeNote(entries: NoteEntry[], id: string): NoteEntry[] {
  return entries.filter((e) => e.id !== id);
}
