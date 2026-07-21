import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * PHI-safe, read-only context DTOs the chat assistant is allowed to fetch. Field
 * names are snake_case — the frontend/tool contract mirrored from senseiAPI's
 * `assistant/context.py`. Times are pre-formatted numeric local strings, never ISO.
 */

/** Default agenda look-ahead window (days). */
export const DEFAULT_AGENDA_DAYS = 7;
/** Minimum agenda look-ahead window (days). */
export const MIN_AGENDA_DAYS = 1;
/** Maximum agenda look-ahead window (days). */
export const MAX_AGENDA_DAYS = 60;

/** A patient the therapist can ask about — name only, no contact/clinical data. */
export class PatientBriefDto {
  @ApiProperty({ description: 'Patient id', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ description: 'Patient full name', example: 'דנה לוי' })
  name!: string;
}

/** One upcoming meeting: enough to answer "who's next", nothing clinical. */
export class AgendaItemDto {
  @ApiProperty({ description: 'Patient name, or null when the event has no patient', nullable: true })
  patient_name!: string | null;

  @ApiProperty({ description: 'Human-readable local start time (DD/MM/YYYY HH:MM)', example: '20/07/2026 09:00' })
  starts_at!: string;
}

/** Scheduling cadence for one patient — readable times and counts only. */
export class CadenceDto {
  @ApiProperty({ description: 'Patient name, or null when unknown', nullable: true })
  patient_name!: string | null;

  @ApiProperty({ description: 'Last past meeting time, or null', nullable: true })
  last_meeting_at!: string | null;

  @ApiProperty({ description: 'Next future meeting time, or null', nullable: true })
  next_meeting_at!: string | null;

  @ApiProperty({ description: 'Total meetings within the ±365-day window', example: 12 })
  total_meetings!: number;
}

/** One meeting of a patient, with the meeting_id needed to fetch its summary. */
export class PatientMeetingDto {
  @ApiProperty({ description: 'Meeting (calendar event) id' })
  meeting_id!: string;

  @ApiProperty({ description: 'Human-readable local start time (DD/MM/YYYY HH:MM)', example: '20/07/2026 09:00' })
  starts_at!: string;

  @ApiProperty({ description: 'Whether a ready summary exists for this meeting', example: true })
  has_summary!: boolean;
}

/** Query params for GET /assistant/context/agenda. */
export class AgendaQueryDto {
  @ApiPropertyOptional({
    description: 'Look-ahead window in days',
    minimum: MIN_AGENDA_DAYS,
    maximum: MAX_AGENDA_DAYS,
    default: DEFAULT_AGENDA_DAYS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_AGENDA_DAYS)
  @Max(MAX_AGENDA_DAYS)
  days: number = DEFAULT_AGENDA_DAYS;
}
