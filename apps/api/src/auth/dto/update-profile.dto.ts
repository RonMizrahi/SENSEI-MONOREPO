import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { FULL_NAME_MAX_LENGTH } from '../auth.constants';

const SHORT_FIELD_MAX = 255;
const GENDERS = ['f', 'm'];

/** PATCH /auth/me body — all fields optional; omitted fields stay unchanged. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name', example: 'ד״ר רותם שגב' })
  @IsOptional()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  full_name?: string;

  @ApiPropertyOptional({ description: 'Phone' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @ApiPropertyOptional({ description: "Gender ('f' | 'm')" })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: string;

  @ApiPropertyOptional({ description: 'Professional title' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_FIELD_MAX)
  title?: string;

  @ApiPropertyOptional({ description: 'License number' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  license_number?: string;

  @ApiPropertyOptional({ description: 'Organization / clinic' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_FIELD_MAX)
  org?: string;

  @ApiPropertyOptional({ description: 'Short bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Avatar background colour', example: '#1F63D6' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  avatar_color?: string;
}
