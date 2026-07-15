import { ApiProperty } from '@nestjs/swagger';
import type { GenerationStatus } from '../../summaries/entities/meeting-summary.entity';

/** Next-meeting prep report — the SPA's NextMeetingReport contract (snake_case). */
export class NextMeetingReportDto {
  @ApiProperty({
    description: 'Patient the report belongs to',
    example: '3f6c1f9e-8a44-4c85-9d3a-2b7f0c1d2e3f',
    format: 'uuid',
  })
  patient_id!: string;

  @ApiProperty({
    description: 'Generation lifecycle status',
    enum: ['pending', 'running', 'ready', 'failed'],
    example: 'ready',
  })
  status!: GenerationStatus;

  @ApiProperty({
    description: 'Opening paragraph (2-3 sentences, Hebrew)',
    example: 'המטופל ממשיך בתהליך טיפולי יציב.',
    nullable: true,
    type: String,
  })
  intro!: string | null;

  @ApiProperty({
    description: 'What changed since the last meeting (3-5 bullet points, Hebrew)',
    example: ['שיפור בדפוסי השינה'],
    type: [String],
  })
  changes!: string[];

  @ApiProperty({
    description: 'Open topics to follow up on (3-5 items, Hebrew)',
    example: ['המשך מעקב אחר איכות השינה'],
    type: [String],
  })
  open_topics!: string[];

  @ApiProperty({
    description: 'Suggested opening questions for the next meeting (Hebrew)',
    example: ['מה הכי חשוב לך שנספיק לגעת בו בפגישה הקרובה?'],
    type: [String],
  })
  questions!: string[];

  @ApiProperty({
    description: 'Meeting ids whose ready summaries fed the report (oldest first)',
    example: ['9b2e6d1c-5f3a-4b7e-8c9d-0a1b2c3d4e5f'],
    type: [String],
  })
  source_meeting_ids!: string[];

  @ApiProperty({
    description: 'First ~500 characters of the most recent ready summary',
    example: 'נושאים מרכזיים: התמודדות עם לחץ בעבודה.',
    nullable: true,
    type: String,
  })
  last_summary_excerpt!: string | null;

  @ApiProperty({
    description: 'When generation finished (ISO 8601), null until ready',
    example: '2026-07-14T10:00:00.000Z',
    nullable: true,
    type: String,
  })
  generated_at!: string | null;

  @ApiProperty({
    description: 'Model that produced the report, null until generated',
    example: 'claude-haiku-4-5',
    nullable: true,
    type: String,
  })
  model!: string | null;

  @ApiProperty({
    description: 'User-facing failure reason when status is failed',
    example: 'אין עדיין סיכומי פגישות למטופל זה',
    nullable: true,
    type: String,
  })
  error!: string | null;
}
