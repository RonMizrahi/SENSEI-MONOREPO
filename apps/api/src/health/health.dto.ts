import { ApiProperty } from '@nestjs/swagger';

/** GET / response. */
export class RootDto {
  @ApiProperty({ example: 'Welcome to SenseiAPI' })
  message!: string;
}

/** GET /health response. */
export class StatusDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

/** GET /ready response. */
export class ReadinessDto {
  @ApiProperty({ example: 'ready' })
  status!: string;

  @ApiProperty({ enum: ['ok', 'unavailable', 'mock'], example: 'ok' })
  database!: 'ok' | 'unavailable' | 'mock';
}
