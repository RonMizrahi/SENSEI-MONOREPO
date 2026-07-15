import { rmSync } from 'node:fs';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { SHARED_URI_FILE } from './shared-postgres';

/** Stops the shared Postgres container started by global-setup. */
export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as { __SENSEI_PG__?: StartedPostgreSqlContainer }).__SENSEI_PG__;
  if (container) await container.stop();
  rmSync(SHARED_URI_FILE, { force: true });
}
