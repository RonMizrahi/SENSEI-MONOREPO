import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Lifecycle of an AI generation job (summaries + patient reports share it). */
export type GenerationStatus = 'pending' | 'running' | 'ready' | 'failed';

/** AI meeting summary — senseiAPI `meeting_summaries` table, 1:1 with a calendar event (foundation-frozen). */
@Entity('meeting_summaries')
export class MeetingSummary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'meeting_id', type: 'uuid', unique: true })
  @Index()
  meetingId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: GenerationStatus;

  @Column({ type: 'text', nullable: true })
  text!: string | null;

  @Column({ type: 'varchar', length: 64, default: '' })
  model!: string;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
