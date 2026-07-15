// Boot-time SQL migration runner against the real stack: Testcontainers Postgres
// + full app. The second boot reuses the SAME database (DATABASE_URL override)
// to prove re-boot is a no-op. ONE mode per file: integration (MOCK_MODE=false).
import { DataSource } from 'typeorm';
import { createIntegrationApp, TestApp } from './utils/app-factory';

const INIT_MIGRATION = '0001_init.sql';
const REPORTS_PER_THERAPIST_MIGRATION = '0002_patient_reports_per_therapist.sql';
// Every versioned SQL file the boot-time runner applies, in filename order.
const EXPECTED_MIGRATIONS = [INIT_MIGRATION, REPORTS_PER_THERAPIST_MIGRATION];
const EXPECTED_TABLES = [
  '_migrations',
  'users',
  'patients',
  'calendar_events',
  'transcripts',
  'meeting_summaries',
  'patient_reports',
];

// this file cannot use the factory's bundled close() for the first app (its
// container must outlive the app), so it restores the env keys itself.
const MANAGED_ENV_KEYS = ['MOCK_MODE', 'DATABASE_URL', 'LOG_LEVEL'];
const originalEnv = new Map(MANAGED_ENV_KEYS.map((key) => [key, process.env[key]]));

/** Reads all public table names of the app database. */
async function listPublicTables(dataSource: DataSource): Promise<string[]> {
  const rows = await dataSource.query<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  return rows.map((row) => row.table_name);
}

/** Reads the recorded migration names, oldest first. */
async function listAppliedMigrations(dataSource: DataSource): Promise<string[]> {
  const rows = await dataSource.query<{ name: string }[]>(
    'SELECT name FROM _migrations ORDER BY applied_at',
  );
  return rows.map((row) => row.name);
}

describe('db migration runner (integration)', () => {
  let firstApp: TestApp | undefined;
  let firstAppStopped = false;
  let secondApp: TestApp | undefined;

  beforeAll(async () => {
    firstApp = await createIntegrationApp();
  });

  afterAll(async () => {
    if (secondApp) {
      await secondApp.close();
    }
    if (firstApp && !firstAppStopped) {
      await firstApp.app.close();
    }
    // firstApp's provisioned database is reclaimed when global-teardown stops the
    // shared container (its app was closed manually to keep the DB alive for re-boot).
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('first boot applies every migration: all schema tables plus _migrations exist', async () => {
    if (!firstApp) throw new Error('first app did not boot');
    const dataSource = firstApp.app.get(DataSource);

    const tables = await listPublicTables(dataSource);
    for (const table of EXPECTED_TABLES) {
      expect(tables).toContain(table);
    }

    await expect(listAppliedMigrations(dataSource)).resolves.toEqual(EXPECTED_MIGRATIONS);
  });

  it('re-boot on the same database succeeds and records nothing new', async () => {
    if (!firstApp) throw new Error('first app did not boot');
    const databaseUrl = firstApp.databaseUrl;

    // stop only the app; keep the database (and its applied schema) alive
    await firstApp.app.close();
    firstAppStopped = true;

    secondApp = await createIntegrationApp({ DATABASE_URL: databaseUrl });
    const dataSource = secondApp.app.get(DataSource);
    await expect(listAppliedMigrations(dataSource)).resolves.toEqual(EXPECTED_MIGRATIONS);
  });
});
