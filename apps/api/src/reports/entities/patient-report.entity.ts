import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { GenerationStatus } from '../../summaries/entities/meeting-summary.entity';

/**
 * Next-meeting prep report — NEW table (`patient_reports`), no Python equivalent.
 * One live report per (patient, therapist): each therapist owns their own row so
 * therapists sharing a patient never collide (regenerated from their summaries).
 */
@Entity('patient_reports')
@Unique('patient_reports_patient_therapist_key', ['patientId', 'therapistId'])
export class PatientReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'therapist_id', type: 'uuid' })
  therapistId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: GenerationStatus;

  @Column({ type: 'text', nullable: true })
  intro!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  changes!: string[];

  @Column({ name: 'open_topics', type: 'jsonb', default: () => "'[]'" })
  openTopics!: string[];

  @Column({ name: 'source_meeting_ids', type: 'jsonb', default: () => "'[]'" })
  sourceMeetingIds!: string[];

  @Column({ name: 'last_summary_excerpt', type: 'text', nullable: true })
  lastSummaryExcerpt!: string | null;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, default: '' })
  model!: string;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
