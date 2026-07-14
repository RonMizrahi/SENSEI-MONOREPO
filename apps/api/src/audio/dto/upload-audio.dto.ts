import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/** Multipart form fields accompanying the uploaded audio file. */
export class UploadAudioDto {
  @ApiProperty({
    description: 'Calendar event (meeting) the transcript belongs to',
    example: 'f0b9a1c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c',
    format: 'uuid',
  })
  @IsUUID()
  meeting_id!: string;

  @ApiPropertyOptional({
    description: 'Patient to cross-check against the meeting (404 when unknown)',
    example: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  patient_id?: string;

  @ApiPropertyOptional({
    description: 'Accepted for app compatibility — ignored by the server',
    example: '2026-07-14',
  })
  @IsOptional()
  @IsString()
  session_date?: string;
}
