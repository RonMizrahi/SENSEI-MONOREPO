import { ApiProperty } from '@nestjs/swagger';
import { Patient } from '../entities/patient.entity';

/** Wire shape of one patient — snake_case parity with senseiAPI and the SPA. */
export class PatientResponseDto {
  @ApiProperty({ description: 'Patient id', format: 'uuid', example: '7d8f1a2e-3b4c-4d5e-8f90-123456789abc' })
  id!: string;

  @ApiProperty({ description: 'Full patient name', example: 'דנה לוי' })
  name!: string;

  @ApiProperty({ description: 'Contact phone number', example: '054-1234567' })
  phone!: string;

  @ApiProperty({ description: 'Contact email, or null', example: 'dana.l@mail.com', nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)', example: '2025-01-15T10:00:00.000Z' })
  created_at!: string;

  @ApiProperty({ description: 'Soft-archive flag', example: false })
  archived!: boolean;

  /**
   * Maps a Patient entity to the wire shape.
   * @param patient The stored entity (camelCase, Date timestamps).
   */
  static fromEntity(patient: Patient): PatientResponseDto {
    const dto = new PatientResponseDto();
    dto.id = patient.id;
    dto.name = patient.name;
    dto.phone = patient.phone;
    dto.email = patient.email;
    dto.created_at = patient.createdAt.toISOString();
    dto.archived = patient.archived;
    return dto;
  }
}
