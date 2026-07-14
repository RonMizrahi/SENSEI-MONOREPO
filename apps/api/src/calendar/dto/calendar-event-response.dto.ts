import { ApiProperty } from '@nestjs/swagger';

/** Calendar event as returned to the SPA — times carry the requested zone's offset. */
export class CalendarEventResponseDto {
  @ApiProperty({ format: 'uuid', example: '3f2c8a1e-5b74-4d09-9e62-b8a4d1c7f503' })
  id!: string;

  @ApiProperty({ example: 'פגישה שבועית — דנה לוי' })
  title!: string;

  @ApiProperty({ nullable: true, example: 'פגישה ראשונה' })
  description!: string | null;

  @ApiProperty({ example: '2026-07-15T10:00:00.000+03:00' })
  start_at!: string;

  @ApiProperty({ example: '2026-07-15T10:50:00.000+03:00' })
  end_at!: string;

  @ApiProperty({ example: '2026-07-14T08:12:45.000+03:00' })
  created_at!: string;

  @ApiProperty({ format: 'uuid', description: 'Owning therapist — always the caller' })
  therapist_id!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  patient_id!: string | null;
}
