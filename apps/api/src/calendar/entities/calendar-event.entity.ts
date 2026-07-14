import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Therapy meeting — senseiAPI `calendar_events` table (foundation-frozen).
 * Half-open interval: start_at inclusive, end_at exclusive. Stored in UTC.
 */
@Entity('calendar_events')
@Index('ix_calendar_events_therapist_start_at', ['therapistId', 'startAt'])
@Index('ix_calendar_events_therapist_end_at', ['therapistId', 'endAt'])
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  description!: string | null;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Owning therapist — taken from the authenticated JWT user (never client-supplied). */
  @Column({ name: 'therapist_id', type: 'uuid' })
  therapistId!: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;
}
