import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One diarized word/segment of a transcript. */
export interface DiarizedSegment {
  speaker: string;
  start_time: number;
  end_time: number;
  text: string;
}

/** Meeting transcript — senseiAPI `transcripts` table, 1:1 with a calendar event (foundation-frozen). */
@Entity('transcripts')
export class Transcript {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'meeting_id', type: 'uuid', unique: true })
  @Index()
  meetingId!: string;

  @Column({ name: 'raw_text', type: 'text' })
  rawText!: string;

  @Column({ name: 'diarized_segments', type: 'jsonb', default: () => "'[]'" })
  diarizedSegments!: DiarizedSegment[];

  @Column({ type: 'varchar', length: 16, default: 'he' })
  language!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
