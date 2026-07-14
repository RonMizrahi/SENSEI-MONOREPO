import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '../calendar.constants';

/**
 * PATCH /calendar/{id} request body — every field optional, but the service
 * rejects a body that provides none of them (senseiAPI parity).
 * `description`/`patient_id` accept an explicit null to clear the value.
 */
export class UpdateCalendarEventDto {
  @ApiPropertyOptional({
    description: 'New title',
    example: 'פגישת מעקב — דנה לוי',
    minLength: TITLE_MIN_LENGTH,
    maxLength: TITLE_MAX_LENGTH,
  })
  @ValidateIf((dto: UpdateCalendarEventDto) => dto.title !== undefined)
  @IsString()
  @Length(TITLE_MIN_LENGTH, TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    description: 'New description (null clears it)',
    example: 'עדכון מטרות טיפול',
    maxLength: DESCRIPTION_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'New start time (ISO 8601; naive values are read in the requested time_zone)',
    example: '2026-07-15T11:00:00',
  })
  @ValidateIf((dto: UpdateCalendarEventDto) => dto.start_at !== undefined)
  @IsISO8601()
  start_at?: string;

  @ApiPropertyOptional({
    description: 'New end time (ISO 8601; naive values are read in the requested time_zone)',
    example: '2026-07-15T11:50:00',
  })
  @ValidateIf((dto: UpdateCalendarEventDto) => dto.end_at !== undefined)
  @IsISO8601()
  end_at?: string;

  @ApiPropertyOptional({
    description: 'New linked patient id (null unlinks)',
    example: 'f4b1c9de-8a24-4f6e-9b31-2c7d5a1e0b42',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  patient_id?: string | null;
}
