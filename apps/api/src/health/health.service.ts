import { Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isMockMode } from '../common/mock-mode';
import type { ReadinessDto } from './health.dto';

/** Readiness probing — pings the database, or reports mock mode. */
@Injectable()
export class HealthService {
  constructor(@Optional() @InjectDataSource() private readonly dataSource?: DataSource) {}

  /**
   * Reports database reachability.
   * @returns 'mock' in MOCK_MODE, 'ok' when SELECT 1 succeeds, else 'unavailable' (status 'not_ready').
   */
  async readiness(): Promise<ReadinessDto> {
    if (isMockMode()) {
      return { status: 'ready', database: 'mock' };
    }
    if (!this.dataSource) {
      return { status: 'not_ready', database: 'unavailable' };
    }
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', database: 'ok' };
    } catch {
      return { status: 'not_ready', database: 'unavailable' };
    }
  }
}
