import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Notification category shown in the SPA's notification center. */
export type NotificationKind = 'summary' | 'risk' | 'reminder' | 'system';

/** Therapist-scoped notification — powers the SPA notifications page. */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'therapist_id', type: 'uuid' })
  @Index()
  therapistId!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: NotificationKind;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  /** Display bucket label as shown in the SPA (היום / אתמול / קודם). */
  @Column({ name: 'group_label', type: 'varchar', length: 32 })
  groupLabel!: string;

  /** Human-relative display time string (e.g. "לפני 8 דק׳"). */
  @Column({ name: 'display_time', type: 'varchar', length: 64 })
  displayTime!: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
