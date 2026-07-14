import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode } from '../common/mock-mode';
import type { Env } from '../config/env.schema';
import { MigrationRunnerService } from './migration-runner.service';

/**
 * Database wiring — TypeORM against DATABASE_URL, or nothing in MOCK_MODE.
 * Schema evolves ONLY via the SQL scripts in db/migrations (the db worker's
 * boot-time runner); TypeORM never synchronizes or migrates.
 */
@Module({})
export class DbModule {
  /** Composes the database imports for the current mode. */
  static forRoot(): DynamicModule {
    if (isMockMode()) {
      return { module: DbModule, imports: [] };
    }
    return {
      module: DbModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            type: 'postgres' as const,
            url: config.get('DATABASE_URL', { infer: true }),
            autoLoadEntities: true,
            synchronize: false,
            migrationsRun: false,
          }),
        }),
      ],
      providers: [MigrationRunnerService],
    };
  }
}
