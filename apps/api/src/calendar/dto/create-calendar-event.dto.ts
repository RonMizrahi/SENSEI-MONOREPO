import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '../calendar.constants';

/** POST /calendar request body — senseiAPI CalendarEventCreate parity. */
export class CreateCalendarEventDto {
  @ApiProperty({
    description: 'Event title',
    example: 'פגישה שבועית — דנה לוי',
    minLength: TITLE_MIN_LENGTH,
    maxLength: TITLE_MAX_LENGTH,
  })
  @IsString()
  @Length(TITLE_MIN_LENGTH, TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional free-text description',
    example: 'פגישה ראשונה',
    maxLength: DESCRIPTION_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiProperty({
    description: 'Start time (ISO 8601; naive values are read in the requested time_zone)',
    example: '2026-07-15T10:00:00',
  })
  @IsISO8601()
  start_at!: string;

  @ApiProperty({
    description: 'End time (ISO 8601; naive values are read in the requested time_zone)',
    example: '2026-07-15T10:50:00',
  })
  @IsISO8601()
  end_at!: string;

  @ApiPropertyOptional({
    description: 'Linked patient id',
    example: 'f4b1c9de-8a24-4f6e-9b31-2c7d5a1e0b42',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  patient_id?: string | null;
}
