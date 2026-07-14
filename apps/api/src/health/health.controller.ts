import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';
import { ReadinessDto, RootDto, StatusDto } from './health.dto';

/** Public health surface — contract parity with senseiAPI's /, /health, /ready. */
@ApiTags('health')
@Public()
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome message' })
  @ApiOkResponse({ type: RootDto })
  root(): RootDto {
    return { message: 'Welcome to SenseiAPI' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness — process is up, no dependency checks' })
  @ApiOkResponse({ type: StatusDto })
  health(): StatusDto {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness — database reachable (or mock mode)' })
  @ApiOkResponse({ type: ReadinessDto })
  @ApiServiceUnavailableResponse({ description: 'Database unreachable' })
  async ready(): Promise<ReadinessDto> {
    const readiness = await this.healthService.readiness();
    if (readiness.database === 'unavailable') {
      throw new ServiceUnavailableException(readiness);
    }
    return readiness;
  }
}
