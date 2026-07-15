import { Injectable } from '@nestjs/common';
import { SEED_PATIENTS, SEED_USER } from '../mock/seed';
import { PatientNote } from './entities/patient-note.entity';
import type { NotesRepositoryContract } from './notes.repository';

/** Default demo clinical note (parity with the SPA LetterPage default note). */
const SEED_NOTE_BODY =
  'מטופל בטיפול. מוטיבציה גבוהה ושיתוף פעולה. הומלץ על המשך מעקב שבועי ועבודה על כלי ויסות.';

/** Composite key for the in-memory map. */
function key(therapistId: string, patientId: string): string {
  return `${therapistId}:${patientId}`;
}

/** MOCK_MODE notes store — in-memory, pre-seeded with a note per demo patient. */
@Injectable()
export class MockNotesRepository implements NotesRepositoryContract {
  private readonly byKey = new Map<string, PatientNote>();

  constructor() {
    for (const patient of SEED_PATIENTS) {
      this.byKey.set(key(SEED_USER.id, patient.id), this.build(SEED_USER.id, patient.id, SEED_NOTE_BODY));
    }
  }

  /** Returns the therapist's note for a patient, or null. */
  find(therapistId: string, patientId: string): Promise<PatientNote | null> {
    return Promise.resolve(this.byKey.get(key(therapistId, patientId)) ?? null);
  }

  /** Upserts the note body in memory and returns it. */
  upsert(therapistId: string, patientId: string, body: string): Promise<PatientNote> {
    const note = this.build(therapistId, patientId, body);
    this.byKey.set(key(therapistId, patientId), note);
    return Promise.resolve(note);
  }

  /** Builds a PatientNote row. */
  private build(therapistId: string, patientId: string, body: string): PatientNote {
    const note = new PatientNote();
    note.therapistId = therapistId;
    note.patientId = patientId;
    note.body = body;
    note.updatedAt = new Date();
    return note;
  }
}
