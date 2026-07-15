/**
 * Standalone migration entry (`pnpm --filter api db:migrate` → node dist/db/migrate-cli).
 * Connects with DATABASE_URL, applies pending SQL migrations, prints what it
 * applied, and exits non-zero on failure.
 */
import 'reflect-metadata';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { isMockMode } from '../common/mock-mode';
import { validateEnv, type Env } from '../config/env.schema';
import { MigrationRunnerService } from './migration-runner.service';

/** Applies pending SQL migrations against DATABASE_URL and reports what ran. */
async function main(): Promise<void> {
  if (isMockMode()) {
    console.log('MOCK_MODE=true — no database, skipping migrations.');
    return;
  }
  // Keep the config context open: the runner reads SEED_DEMO_DATA (and DATABASE_URL) from it.
  const context = await NestFactory.createApplicationContext(
    ConfigModule.forRoot({ validate: validateEnv, isGlobal: true }),
    { logger: false },
  );
  const config = context.get<ConfigService<Env, true>>(ConfigService);
  const dataSource = new DataSource({
    type: 'postgres',
    url: config.get('DATABASE_URL', { infer: true }),
  });
  try {
    await dataSource.initialize();
    const applied = await new MigrationRunnerService(dataSource, config).run();
    if (applied.length === 0) {
      console.log('No pending migrations.');
      return;
    }
    for (const name of applied) {
      console.log(`Applied ${name}`);
    }
  } finally {
    // initialize() may have thrown (e.g. DB unreachable) — only destroy a live source.
    if (dataSource.isInitialized) await dataSource.destroy();
    await context.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
