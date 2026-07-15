import { writeFileSync } from 'node:fs';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { SHARED_URI_FILE } from './shared-postgres';

/**
 * Starts ONE Postgres container for the whole integration run; each suite
 * provisions its own database on it (see provisionDatabase). Stashed on
 * globalThis so global-teardown (same parent process) can stop it.
 */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start();
  (globalThis as { __SENSEI_PG__?: unknown }).__SENSEI_PG__ = container;
  writeFileSync(SHARED_URI_FILE, container.getConnectionUri());
}
