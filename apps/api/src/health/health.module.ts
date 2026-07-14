import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Public health endpoints (/, /health, /ready) — foundation-owned. */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
