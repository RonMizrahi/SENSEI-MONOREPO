import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import type { PatientNote } from '../entities/patient-note.entity';

/** Max clinical-note length (generous; a note is a paragraph, not a document). */
const NOTE_MAX_LENGTH = 5000;

/** GET/PUT /patients/{id}/notes response — the therapist's note for a patient. */
export class NoteResponseDto {
  @ApiProperty({ description: 'Patient id', format: 'uuid' })
  patient_id!: string;

  @ApiProperty({ description: 'Note body (empty string when unset)', example: 'מטופל בטיפול…' })
  body!: string;

  @ApiProperty({ description: 'Last update timestamp (ISO 8601)', format: 'date-time', nullable: true })
  updated_at!: string | null;

  /** Maps a stored note (or absence) onto the wire shape. */
  static of(patientId: string, note: PatientNote | null): NoteResponseDto {
    const dto = new NoteResponseDto();
    dto.patient_id = patientId;
    dto.body = note?.body ?? '';
    dto.updated_at = note ? note.updatedAt.toISOString() : null;
    return dto;
  }
}

/** PUT /patients/{id}/notes body — replaces the note text. */
export class UpdateNoteDto {
  @ApiProperty({ description: 'Note body', example: 'מטופל בטיפול…' })
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  body!: string;
}
