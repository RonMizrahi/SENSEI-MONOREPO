import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { User } from '../entities/user.entity';
import {
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../auth.constants';

/** POST /auth/register request body (senseiAPI UserCreate parity). */
export class RegisterRequestDto {
  @ApiProperty({ description: 'Login email — normalized to lowercase', example: 'therapist@clinic.co.il' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Plain password',
    example: 'demo1234',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'ד״ר רותם שגב', maxLength: FULL_NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  full_name?: string;
}

/** POST /auth/register 201 response (senseiAPI UserOut parity). */
export class RegisterResponseDto {
  @ApiProperty({ description: 'New user id', format: 'uuid' })
  user_id!: string;

  @ApiProperty({ description: 'Authentication mechanism', example: 'password' })
  auth_type!: string;

  @ApiProperty({ description: 'Coarse role', example: 'therapist' })
  role!: string;

  @ApiProperty({ description: 'Normalized login email', example: 'therapist@clinic.co.il' })
  email!: string;

  @ApiProperty({ description: 'Display name', nullable: true, type: String })
  full_name!: string | null;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)', example: '2026-07-14T10:00:00.000Z' })
  created_at!: string;

  /**
   * Maps a persisted user row onto the wire shape.
   * @param user The freshly created user.
   */
  static fromUser(user: User): RegisterResponseDto {
    const dto = new RegisterResponseDto();
    dto.user_id = user.id;
    dto.auth_type = user.authType;
    dto.role = user.role;
    dto.email = user.email;
    dto.full_name = user.fullName;
    dto.created_at = user.createdAt.toISOString();
    return dto;
  }
}
