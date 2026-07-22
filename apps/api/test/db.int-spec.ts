// Boot-time SQL migration runner against the real stack: Testcontainers Postgres
// + full app. The second boot reuses the SAME database (DATABASE_URL override)
// to prove re-boot is a no-op. ONE mode per file: integration (MOCK_MODE=false).
import { DataSource } from 'typeorm';
import { createIntegrationApp, TestApp } from './utils/app-factory';

const INIT_MIGRATION = '0001_init.sql';
const REPORTS_PER_THERAPIST_MIGRATION = '0002_patient_reports_per_therapist.sql';
const SEED_DEMO_PROTOTYPE_MIGRATION = '0003_seed_demo_prototype.sql';
const SEED_DEMO_IDENTITY_MIGRATION = '0004_seed_demo_identity.sql';
const MEETING_SUMMARY_INSIGHT_MIGRATION = '0005_meeting_summary_insight.sql';
const SEED_DEMO_SESSIONS_MIGRATION = '0006_seed_demo_sessions.sql';
const NOTIFICATIONS_MIGRATION = '0007_notifications.sql';
const SEED_DEMO_NOTIFICATIONS_MIGRATION = '0008_seed_demo_notifications.sql';
const USER_PROFILE_SETTINGS_MIGRATION = '0009_user_profile_settings.sql';
const SEED_DEMO_PROFILE_MIGRATION = '0010_seed_demo_profile.sql';
const REPORT_QUESTIONS_NOTES_MIGRATION = '0011_report_questions_and_notes.sql';
const SEED_DEMO_REPORTS_NOTES_MIGRATION = '0012_seed_demo_reports_notes.sql';
const MEETING_REPORTS_MIGRATION = '0013_meeting_reports.sql';
// Every versioned SQL file the boot-time runner applies, in filename order. Seed
// migrations apply (and are tracked) in every env; their inserts are gated by
// SEED_DEMO_DATA, so this list is identical across dev and prod.
const EXPECTED_MIGRATIONS = [
  INIT_MIGRATION,
  REPORTS_PER_THERAPIST_MIGRATION,
  SEED_DEMO_PROTOTYPE_MIGRATION,
  SEED_DEMO_IDENTITY_MIGRATION,
  MEETING_SUMMARY_INSIGHT_MIGRATION,
  SEED_DEMO_SESSIONS_MIGRATION,
  NOTIFICATIONS_MIGRATION,
  SEED_DEMO_NOTIFICATIONS_MIGRATION,
  USER_PROFILE_SETTINGS_MIGRATION,
  SEED_DEMO_PROFILE_MIGRATION,
  REPORT_QUESTIONS_NOTES_MIGRATION,
  SEED_DEMO_REPORTS_NOTES_MIGRATION,
  MEETING_REPORTS_MIGRATION,
];
const EXPECTED_TABLES = [
  '_migrations',
  'users',
  'patients',
  'calendar_events',
  'transcripts',
  'meeting_summaries',
  'patient_reports',
  'notifications',
  'user_settings',
  'patient_notes',
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

/** Counts rows in a table (identifier is a trusted test constant, not user input). */
async function countRows(dataSource: DataSource, table: string): Promise<number> {
  const rows = await dataSource.query<{ count: string }[]>(`SELECT count(*) AS count FROM ${table}`);
  return Number(rows[0]?.count ?? 0);
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

  it('demo-seed gate off (default): seed migrations apply but insert no gated rows', async () => {
    if (!firstApp) throw new Error('first app did not boot');
    const dataSource = firstApp.app.get(DataSource);
    // SEED_DEMO_DATA is unset here, so 0004's guarded inserts affect 0 rows:
    // no demo therapist and no seeded appointments reach a production-shaped DB.
    await expect(countRows(dataSource, 'users')).resolves.toBe(0);
    await expect(countRows(dataSource, 'calendar_events')).resolves.toBe(0);
    // 0003 seeds the 4 demo patients UNCONDITIONALLY (not gated) — lock that contract
    // so a future guard added/removed on 0003 can't silently flip it.
    await expect(countRows(dataSource, 'patients')).resolves.toBe(4);
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
