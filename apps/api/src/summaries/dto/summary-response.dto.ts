import { ApiProperty } from '@nestjs/swagger';
import type { GenerationStatus, MeetingSummary } from '../entities/meeting-summary.entity';

const GENERATION_STATUSES: GenerationStatus[] = ['pending', 'running', 'ready', 'failed'];

/** GET/POST /meetings/{id}/summary response — snake_case contract shared with the SPA. */
export class SummaryResponseDto {
  @ApiProperty({
    description: 'Meeting (calendar event) id the summary belongs to',
    format: 'uuid',
    example: '7f9c1c1e-2b6a-4e0e-9f6a-1234567890ab',
  })
  meeting_id!: string;

  @ApiProperty({
    description: 'Generation lifecycle status',
    enum: GENERATION_STATUSES,
    example: 'ready',
  })
  status!: GenerationStatus;

  @ApiProperty({
    description: 'Generated Hebrew summary text (null until ready)',
    nullable: true,
    type: String,
    example: '## נושאים מרכזיים\n…',
  })
  text!: string | null;

  @ApiProperty({
    description: 'Model that produced the text (null until ready)',
    nullable: true,
    type: String,
    example: 'claude-haiku-4-5',
  })
  model!: string | null;

  @ApiProperty({
    description: 'Failure reason when status is failed',
    nullable: true,
    type: String,
    example: null,
  })
  error!: string | null;

  @ApiProperty({
    description: 'Short per-session clinical insight shown on the session detail screen',
    nullable: true,
    type: String,
    example: 'נצפה שימוש עצמאי בכלי ויסות תחת לחץ…',
  })
  insight!: string | null;

  /** Maps a MeetingSummary row onto the wire shape (empty model → null, Python parity). */
  static fromEntity(summary: MeetingSummary): SummaryResponseDto {
    const dto = new SummaryResponseDto();
    dto.meeting_id = summary.meetingId;
    dto.status = summary.status;
    dto.text = summary.text;
    dto.model = summary.model || null;
    dto.error = summary.error;
    dto.insight = summary.insight;
    return dto;
  }

  /** Builds the deterministic pending body returned right after (re)queueing. */
  static pending(meetingId: string): SummaryResponseDto {
    const dto = new SummaryResponseDto();
    dto.meeting_id = meetingId;
    dto.status = 'pending';
    dto.text = null;
    dto.model = null;
    dto.error = null;
    dto.insight = null;
    return dto;
  }
}
