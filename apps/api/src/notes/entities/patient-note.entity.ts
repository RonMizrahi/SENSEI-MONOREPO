import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Per-therapist free-text clinical note about a patient (one row per therapist+patient). */
@Entity('patient_notes')
export class PatientNote {
  @PrimaryColumn({ name: 'therapist_id', type: 'uuid' })
  therapistId!: string;

  @PrimaryColumn({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ type: 'text' })
  body!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
