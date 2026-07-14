import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import {
  PATIENT_NAME_MAX_LENGTH,
  PATIENT_NAME_MIN_LENGTH,
  PATIENT_PHONE_MAX_LENGTH,
  PATIENT_PHONE_MIN_LENGTH,
} from '../patients.constants';
import { TrimmedString } from './trim.transform';

/** POST /patients request body. */
export class CreatePatientDto {
  @ApiProperty({ description: 'Full patient name', example: 'דנה לוי', minLength: PATIENT_NAME_MIN_LENGTH, maxLength: PATIENT_NAME_MAX_LENGTH })
  @TrimmedString()
  @IsString()
  @Length(PATIENT_NAME_MIN_LENGTH, PATIENT_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({ description: 'Contact phone number', example: '054-1234567', minLength: PATIENT_PHONE_MIN_LENGTH, maxLength: PATIENT_PHONE_MAX_LENGTH })
  @TrimmedString()
  @IsString()
  @Length(PATIENT_PHONE_MIN_LENGTH, PATIENT_PHONE_MAX_LENGTH)
  phone!: string;

  @ApiPropertyOptional({ description: 'Contact email — omit or send null for none', example: 'dana.l@mail.com', nullable: true })
  @IsOptional()
  @TrimmedString()
  @IsEmail()
  email?: string | null;
}
