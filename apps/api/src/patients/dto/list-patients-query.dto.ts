import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** GET /patients query string. */
export class ListPatientsQueryDto {
  @ApiPropertyOptional({
    description: "'true' returns ONLY archived patients; anything else (or absent) returns only active ones",
    example: 'true',
  })
  @IsOptional()
  // a repeated ?archived= param arrives as an array — the last occurrence wins
  @Transform(({ value }) => (Array.isArray(value) ? value.at(-1) : value) === 'true')
  @IsBoolean()
  archived: boolean = false;
}
