import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { GenerationStatus } from '../../summaries/entities/meeting-summary.entity';

/**
 * Prep report — NEW table (`patient_reports`), no Python equivalent. Each therapist
 * owns their own rows (regenerated from their summaries) so therapists sharing a
 * patient never collide. Two report kinds coexist per (patient, therapist), enforced
 * by partial unique indexes (see migration 0013): the per-patient "next-meeting"
 * report is the row with `meeting_id IS NULL`; each specific meeting gets its own row
 * keyed by `meeting_id`.
 */
@Entity('patient_reports')
export class PatientReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'therapist_id', type: 'uuid' })
  therapistId!: string;

  /** Specific meeting this report is for; NULL marks the per-patient next-meeting report. */
  @Column({ name: 'meeting_id', type: 'uuid', nullable: true })
  @Index()
  meetingId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: GenerationStatus;

  @Column({ type: 'text', nullable: true })
  intro!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  changes!: string[];

  @Column({ name: 'open_topics', type: 'jsonb', default: () => "'[]'" })
  openTopics!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  questions!: string[];

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
