import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import {
  PATIENT_NAME_MAX_LENGTH,
  PATIENT_NAME_MIN_LENGTH,
  PATIENT_PHONE_MAX_LENGTH,
  PATIENT_PHONE_MIN_LENGTH,
} from '../patients.constants';
import { TrimmedString } from './trim.transform';

/** Runs the field's validators for any present value (incl. null) but skips absent ones. */
const whenPresent = ValidateIf((_object: unknown, value: unknown) => value !== undefined);

/**
 * PATCH /patients/{id} request body — every field optional, but at least one
 * must be present (enforced in PatientsService). Only `email` accepts null (clears it).
 */
export class UpdatePatientDto {
  @ApiPropertyOptional({ description: 'Full patient name', example: 'דנה לוי', minLength: PATIENT_NAME_MIN_LENGTH, maxLength: PATIENT_NAME_MAX_LENGTH })
  @whenPresent
  @TrimmedString()
  @IsString()
  @Length(PATIENT_NAME_MIN_LENGTH, PATIENT_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '054-1234567', minLength: PATIENT_PHONE_MIN_LENGTH, maxLength: PATIENT_PHONE_MAX_LENGTH })
  @whenPresent
  @TrimmedString()
  @IsString()
  @Length(PATIENT_PHONE_MIN_LENGTH, PATIENT_PHONE_MAX_LENGTH)
  phone?: string;

  @ApiPropertyOptional({ description: 'Contact email — send null to clear it', example: 'dana.l@mail.com', nullable: true })
  @IsOptional()
  @TrimmedString()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ description: 'Soft-archive flag — archived patients leave the default roster', example: true })
  @whenPresent
  @IsBoolean()
  archived?: boolean;
}
