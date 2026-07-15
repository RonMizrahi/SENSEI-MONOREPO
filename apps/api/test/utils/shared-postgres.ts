import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

/** Env var global-setup uses to publish the shared container URI (same process under --runInBand). */
export const SHARED_URI_ENV = '__SENSEI_TEST_PG_URI__';

/** File fallback for the shared URI (covers non-runInBand workers, which don't inherit env). */
export const SHARED_URI_FILE = join(tmpdir(), 'sensei-int-pg-uri');

/**
 * The shared Testcontainers Postgres admin URI (published by global-setup).
 * Prefers the per-process env var (collision-free) and falls back to the file.
 * @throws Error with actionable guidance when neither is present.
 */
export function sharedAdminUri(): string {
  const fromEnv = process.env[SHARED_URI_ENV];
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(SHARED_URI_FILE, 'utf8').trim();
  } catch {
    throw new Error(
      'Shared Postgres not initialized — run integration tests via `pnpm --filter api test:int` ' +
        '(the jest-int globalSetup starts the shared container).',
    );
  }
}

/** Rewrites a connection URI to point at a different database on the same server. */
function withDatabase(uri: string, dbName: string): string {
  const url = new URL(uri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** A freshly provisioned, isolated test database on the shared server. */
export interface ProvisionedDatabase {
  uri: string;
  drop(): Promise<void>;
}

/** Runs one admin statement over a short-lived connection to the shared server. */
async function runAdmin(adminUri: string, sql: string): Promise<void> {
  const admin = new DataSource({ type: 'postgres', url: adminUri });
  await admin.initialize();
  try {
    await admin.query(sql);
  } finally {
    await admin.destroy();
  }
}

/**
 * Creates a uniquely-named database on the shared Postgres server so each suite
 * gets isolation without paying for its own container.
 */
export async function provisionDatabase(): Promise<ProvisionedDatabase> {
  const adminUri = sharedAdminUri();
  const dbName = `t_${randomUUID().replace(/-/g, '')}`;
  await runAdmin(adminUri, `CREATE DATABASE "${dbName}"`);
  return {
    uri: withDatabase(adminUri, dbName),
    drop: () => runAdmin(adminUri, `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`),
  };
}
