import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientNote } from './entities/patient-note.entity';

/** DI token consumers use to obtain the notes repository (real or mock). */
export const NOTES_REPOSITORY = Symbol('NOTES_REPOSITORY');

/** Data-access contract for per-therapist patient notes. */
export interface NotesRepositoryContract {
  /** Returns the therapist's note for a patient, or null when none exists. */
  find(therapistId: string, patientId: string): Promise<PatientNote | null>;
  /** Upserts the note body and returns the stored row. */
  upsert(therapistId: string, patientId: string, body: string): Promise<PatientNote>;
}

/** PostgreSQL-backed notes repository (upsert on the composite PK). */
@Injectable()
export class NotesRepository implements NotesRepositoryContract {
  constructor(@InjectRepository(PatientNote) private readonly notes: Repository<PatientNote>) {}

  /** Returns the therapist's note for a patient, or null. */
  find(therapistId: string, patientId: string): Promise<PatientNote | null> {
    return this.notes.findOne({ where: { therapistId, patientId } });
  }

  /** Upserts the note body (save keys on the composite PK) and returns it. */
  upsert(therapistId: string, patientId: string, body: string): Promise<PatientNote> {
    return this.notes.save(this.notes.create({ therapistId, patientId, body }));
  }
}
