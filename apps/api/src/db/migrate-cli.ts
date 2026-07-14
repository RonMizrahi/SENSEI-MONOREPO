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

/** Resolves DATABASE_URL through the validated env schema (ConfigService, no raw process.env). */
async function resolveDatabaseUrl(): Promise<string> {
  const context = await NestFactory.createApplicationContext(
    ConfigModule.forRoot({ validate: validateEnv }),
    { logger: false },
  );
  try {
    const config = context.get<ConfigService<Env, true>>(ConfigService);
    return config.get('DATABASE_URL', { infer: true });
  } finally {
    await context.close();
  }
}

/** Applies pending SQL migrations against DATABASE_URL and reports what ran. */
async function main(): Promise<void> {
  if (isMockMode()) {
    console.log('MOCK_MODE=true — no database, skipping migrations.');
    return;
  }
  const dataSource = new DataSource({ type: 'postgres', url: await resolveDatabaseUrl() });
  await dataSource.initialize();
  try {
    const applied = await new MigrationRunnerService(dataSource).run();
    if (applied.length === 0) {
      console.log('No pending migrations.');
      return;
    }
    for (const name of applied) {
      console.log(`Applied ${name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
