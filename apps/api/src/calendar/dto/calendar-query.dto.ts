import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { DATE_ONLY_PATTERN, DEFAULT_TIME_ZONE } from '../calendar.constants';

/** Query accepted by every /calendar endpoint — the response time zone. */
export class TimeZoneQueryDto {
  @ApiPropertyOptional({
    description: 'IANA time zone for reading naive inputs and rendering times',
    example: DEFAULT_TIME_ZONE,
    default: DEFAULT_TIME_ZONE,
  })
  @IsOptional()
  @IsString()
  time_zone?: string;
}

/** GET /calendar query — optional date window plus the shared time zone. */
export class ListCalendarEventsQueryDto extends TimeZoneQueryDto {
  @ApiPropertyOptional({
    description: 'Window start date (YYYY-MM-DD, inclusive). Defaults per senseiAPI week rules.',
    example: '2026-07-12',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'from must be formatted YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Window end date (YYYY-MM-DD, inclusive). Defaults per senseiAPI week rules.',
    example: '2026-07-18',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'to must be formatted YYYY-MM-DD' })
  to?: string;
}
