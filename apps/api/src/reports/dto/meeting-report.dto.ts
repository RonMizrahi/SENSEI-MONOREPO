import { ApiProperty } from '@nestjs/swagger';
import type { GenerationStatus } from '../../summaries/entities/meeting-summary.entity';
import { NextMeetingReportDto } from './next-meeting-report.dto';

/** Per-meeting prep report — the next-meeting contract plus the owning meeting id (snake_case). */
export class MeetingReportDto extends NextMeetingReportDto {
  @ApiProperty({
    description: 'Meeting (calendar event) this report is for',
    example: '9b2e6d1c-5f3a-4b7e-8c9d-0a1b2c3d4e5f',
    format: 'uuid',
  })
  meeting_id!: string;
}

/** One entry in a patient's list of per-meeting prep reports (snake_case). */
export class MeetingReportListItemDto {
  @ApiProperty({
    description: 'Meeting (calendar event) the report is for',
    example: '9b2e6d1c-5f3a-4b7e-8c9d-0a1b2c3d4e5f',
    format: 'uuid',
  })
  meeting_id!: string;

  @ApiProperty({
    description: 'Generation lifecycle status',
    enum: ['pending', 'running', 'ready', 'failed'],
    example: 'ready',
  })
  status!: GenerationStatus;

  @ApiProperty({
    description: 'When generation finished (ISO 8601), null until ready',
    example: '2026-07-14T10:00:00.000Z',
    nullable: true,
    type: String,
  })
  generated_at!: string | null;
}
