// Next-meeting prep report against the real stack: Testcontainers Postgres + full app,
// with the Anthropic generator stubbed deterministically via overrideProvider.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { provisionDatabase, type ProvisionedDatabase } from './utils/shared-postgres';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { configureApp } from '../src/app.setup';
import { REPORT_GENERATOR, ReportGenerator } from '../src/reports/report-generator.interface';
import { NO_SUMMARIES_ERROR } from '../src/reports/reports.constants';
import { registerAndLogin } from './utils/app-factory';

const STUB_MODEL = 'stub-claude';
const STUB_INTRO = 'מבוא לדוח ההכנה';
const STUB_CHANGES = ['שינוי ראשון', 'שינוי שני', 'שינוי שלישי'];
const STUB_OPEN_TOPICS = ['נושא ראשון', 'נושא שני', 'נושא שלישי'];
const EXCERPT_CAP = 500;
const POLL_DEADLINE_MS = 30_000;
const POLL_INTERVAL_MS = 200;

const stubGenerator: ReportGenerator = {
  generate: () =>
    Promise.resolve({
      intro: STUB_INTRO,
      changes: [...STUB_CHANGES],
      openTopics: [...STUB_OPEN_TOPICS],
      model: STUB_MODEL,
    }),
};

const reportSchema = z.object({
  patient_id: z.uuid(),
  status: z.enum(['pending', 'running', 'ready', 'failed']),
  intro: z.string().nullable(),
  changes: z.array(z.string()),
  open_topics: z.array(z.string()),
  source_meeting_ids: z.array(z.string()),
  last_summary_excerpt: z.string().nullable(),
  generated_at: z.string().nullable(),
  model: z.string().nullable(),
  error: z.string().nullable(),
});

/** Applies env overrides for the app under test and returns a restore function. */
function applyEnv(overrides: Record<string, string>): () => void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

/**
 * Boots the full app against the container with the report generator stubbed.
 * Local variant of test/utils createIntegrationApp (frozen) — needed for overrideProvider.
 */
async function bootAppWithStub(databaseUri: string): Promise<{
  app: INestApplication;
  restore: () => void;
}> {
  const restore = applyEnv({
    MOCK_MODE: 'false',
    DATABASE_URL: databaseUri,
    LOG_LEVEL: 'fatal',
  });
  // import AFTER env is set — module composition reads MOCK_MODE at import time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../src/app.module') as { AppModule: new () => unknown };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REPORT_GENERATOR)
    .useValue(stubGenerator)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, restore };
}

/** Applies the SQL migrations when absent (no-op once the boot-time runner lands). */
async function ensureSchema(dataSource: DataSource): Promise<void> {
  const patients = await dataSource.query<{ table: string | null }[]>(
    "SELECT to_regclass('public.patients') AS table",
  );
  if (!patients[0]?.table) {
    const sql = readFileSync(join(__dirname, '../db/migrations/0001_init.sql'), 'utf8');
    await dataSource.query(sql);
  }
  // Apply 0002 (per-therapist reports) when its column is not yet present.
  const scoped = await dataSource.query<{ column: string | null }[]>(
    `SELECT column_name AS column FROM information_schema.columns
     WHERE table_name = 'patient_reports' AND column_name = 'therapist_id'`,
  );
  if (!scoped[0]?.column) {
    const sql = readFileSync(
      join(__dirname, '../db/migrations/0002_patient_reports_per_therapist.sql'),
      'utf8',
    );
    await dataSource.query(sql);
  }
}

/**
 * A Bearer token + matching users row. Prefers the real /auth endpoints
 * (registerAndLogin); falls back to a directly-inserted user + signed JWT while
 * the auth unit has not landed yet.
 */
async function createTherapist(
  app: INestApplication,
  dataSource: DataSource,
): Promise<{ token: string; userId: string }> {
  try {
    const { token, email } = await registerAndLogin(app);
    const rows = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    return { token, userId: rows[0].id };
  } catch {
    const userId = randomUUID();
    const email = `reports-${userId}@test.local`;
    await dataSource.query(
      `INSERT INTO users (id, auth_type, role, email, full_name, password_hash)
       VALUES ($1, 'password', 'therapist', $2, 'Reports IT', 'not-a-real-hash')`,
      [userId, email],
    );
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: userId,
      email,
      full_name: 'Reports IT',
      auth_type: 'password',
      role: 'therapist',
      token_version: 0,
    });
    return { token, userId };
  }
}

describe('reports (integration)', () => {
  let database: ProvisionedDatabase;
  let app: INestApplication;
  let restore: () => void;
  let httpServer: App;
  let dataSource: DataSource;
  let token: string;
  let userId: string;
  let otherToken: string;
  let otherUserId: string;
  let throttlerStorage: ThrottlerStorageService;

  const pathFor = (patientId: string): string => `/patients/${patientId}/next-meeting-report`;

  /** Inserts a patient row and returns its id. */
  async function seedPatient(): Promise<string> {
    const patientId = randomUUID();
    await dataSource.query(
      "INSERT INTO patients (id, name, phone) VALUES ($1, 'מטופל בדיקה', '050-0000000')",
      [patientId],
    );
    return patientId;
  }

  /** Inserts a calendar event owned by a therapist for the patient; returns the meeting id. */
  async function seedMeetingFor(
    ownerId: string,
    patientId: string,
    startAt: string,
  ): Promise<string> {
    const meetingId = randomUUID();
    await dataSource.query(
      `INSERT INTO calendar_events (id, title, start_at, end_at, therapist_id, patient_id)
       VALUES ($1, 'פגישה', $2, $2::timestamptz + interval '50 minutes', $3, $4)`,
      [meetingId, startAt, ownerId, patientId],
    );
    return meetingId;
  }

  /** Inserts a calendar event for the primary therapist and returns the meeting id. */
  function seedMeeting(patientId: string, startAt: string): Promise<string> {
    return seedMeetingFor(userId, patientId, startAt);
  }

  /** Inserts a meeting summary row. */
  async function seedSummary(meetingId: string, status: string, text: string): Promise<void> {
    await dataSource.query(
      "INSERT INTO meeting_summaries (id, meeting_id, status, text, model) VALUES ($1, $2, $3, $4, 'stub')",
      [randomUUID(), meetingId, status, text],
    );
  }

  /** Polls GET (as the given bearer) until the report settles (200), asserting 202 on the way. */
  async function pollUntilSettledAs(
    patientId: string,
    bearer: string,
  ): Promise<request.Response> {
    const deadline = Date.now() + POLL_DEADLINE_MS;
    for (;;) {
      const response = await request(httpServer)
        .get(pathFor(patientId))
        .set('Authorization', `Bearer ${bearer}`);
      if (response.status === 200) return response;
      expect(response.status).toBe(202);
      if (Date.now() > deadline) throw new Error('report did not settle in time');
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  /** Polls as the primary therapist. */
  function pollUntilSettled(patientId: string): Promise<request.Response> {
    return pollUntilSettledAs(patientId, token);
  }

  beforeAll(async () => {
    database = await provisionDatabase();
    ({ app, restore } = await bootAppWithStub(database.uri));
    httpServer = app.getHttpServer() as App;
    dataSource = app.get(DataSource);
    throttlerStorage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    await ensureSchema(dataSource);
    ({ token, userId } = await createTherapist(app, dataSource));
    ({ token: otherToken, userId: otherUserId } = await createTherapist(app, dataSource));
  }, 120_000);

  beforeEach(() => {
    // The global rate limiter is not under test — keep sequential tests independent.
    throttlerStorage.storage.clear();
  });

  afterAll(async () => {
    await app.close();
    restore();
    await database.drop();
  });

  it('rejects unauthenticated requests', async () => {
    await request(httpServer).get(pathFor(randomUUID())).expect(401);
  });

  it('GET returns 404 before any report was requested', async () => {
    const patientId = await seedPatient();
    await request(httpServer)
      .get(pathFor(patientId))
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('POST returns 404 for an unknown patient', async () => {
    await request(httpServer)
      .post(pathFor(randomUUID()))
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rejects a non-UUID patient id with 400', async () => {
    await request(httpServer)
      .get('/patients/not-a-uuid/next-meeting-report')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('POST → 202 pending → poll → 200 ready with the full contract', async () => {
    const patientId = await seedPatient();
    const olderMeeting = await seedMeeting(patientId, '2026-01-05T10:00:00Z');
    const recentMeeting = await seedMeeting(patientId, '2026-02-05T10:00:00Z');
    const pendingMeeting = await seedMeeting(patientId, '2026-03-05T10:00:00Z');
    const recentText = 'ס'.repeat(EXCERPT_CAP + 50);
    await seedSummary(olderMeeting, 'ready', 'סיכום הפגישה הישנה');
    await seedSummary(recentMeeting, 'ready', recentText);
    await seedSummary(pendingMeeting, 'pending', 'עוד לא מוכן');

    const posted = await request(httpServer)
      .post(pathFor(patientId))
      .set('Authorization', `Bearer ${token}`)
      .expect(202);
    const pendingBody = reportSchema.parse(posted.body);
    expect(pendingBody).toMatchObject({ patient_id: patientId, status: 'pending' });

    const settled = await pollUntilSettled(patientId);
    const report = reportSchema.parse(settled.body);
    expect(report).toEqual({
      patient_id: patientId,
      status: 'ready',
      intro: STUB_INTRO,
      changes: STUB_CHANGES,
      open_topics: STUB_OPEN_TOPICS,
      source_meeting_ids: [olderMeeting, recentMeeting],
      last_summary_excerpt: recentText.slice(0, EXCERPT_CAP),
      generated_at: expect.any(String) as string,
      model: STUB_MODEL,
      error: null,
    });
  });

  it('POST for a patient with no ready summaries settles as failed with the Hebrew error', async () => {
    const patientId = await seedPatient();
    // The caller owns a meeting with the patient (passes ownership) but it has no ready summary.
    await seedMeeting(patientId, '2026-01-20T10:00:00Z');
    await request(httpServer)
      .post(pathFor(patientId))
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    const settled = await pollUntilSettled(patientId);
    const report = reportSchema.parse(settled.body);
    expect(report).toMatchObject({
      patient_id: patientId,
      status: 'failed',
      error: NO_SUMMARIES_ERROR,
      intro: null,
      generated_at: null,
    });
  });

  it('re-POST wipes a settled report back to pending and regenerates', async () => {
    const patientId = await seedPatient();
    const meetingId = await seedMeeting(patientId, '2026-04-05T10:00:00Z');
    await seedSummary(meetingId, 'ready', 'סיכום יחיד');

    await request(httpServer)
      .post(pathFor(patientId))
      .set('Authorization', `Bearer ${token}`)
      .expect(202);
    await pollUntilSettled(patientId);

    const reposted = await request(httpServer)
      .post(pathFor(patientId))
      .set('Authorization', `Bearer ${token}`)
      .expect(202);
    expect(reportSchema.parse(reposted.body)).toMatchObject({
      status: 'pending',
      intro: null,
      generated_at: null,
    });
    const settled = await pollUntilSettled(patientId);
    expect(reportSchema.parse(settled.body).status).toBe('ready');
  });

  describe('cross-therapist isolation (IDOR)', () => {
    // therapist A owns a meeting + ready summary with the (shared-roster) patient.
    async function seedPatientWithReadySummaryForA(): Promise<string> {
      const patientId = await seedPatient();
      const meetingId = await seedMeeting(patientId, '2026-05-05T10:00:00Z');
      await seedSummary(meetingId, 'ready', 'סיכום של מטפל א׳');
      return patientId;
    }

    it('B gets 404 on GET/POST for a patient B has never met; A (owner) succeeds', async () => {
      const patientId = await seedPatientWithReadySummaryForA();

      // B never had a meeting with this patient → cannot probe or mint a report.
      await request(httpServer)
        .get(pathFor(patientId))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
      await request(httpServer)
        .post(pathFor(patientId))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      // owner A can generate and read the report (positive control)
      await request(httpServer)
        .post(pathFor(patientId))
        .set('Authorization', `Bearer ${token}`)
        .expect(202);
      const settled = await pollUntilSettled(patientId);
      expect(reportSchema.parse(settled.body).status).toBe('ready');
    });

    it('never aggregates another therapist’s summaries — B with no summary of their own fails', async () => {
      const patientId = await seedPatientWithReadySummaryForA();
      // B has their own meeting with the shared patient, but NO ready summary of their own.
      await seedMeetingFor(otherUserId, patientId, '2026-06-05T10:00:00Z');

      await request(httpServer)
        .post(pathFor(patientId))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(202);
      const settled = await pollUntilSettledAs(patientId, otherToken);
      // A's ready summary must not leak into B's report → B has no ready summaries → failed.
      expect(reportSchema.parse(settled.body)).toMatchObject({
        status: 'failed',
        error: NO_SUMMARIES_ERROR,
      });
    });

    it('two therapists sharing a patient each get their OWN report row (no collision, no leak)', async () => {
      // A owns a meeting + ready summary with the shared-roster patient.
      const patientId = await seedPatient();
      const aMeeting = await seedMeeting(patientId, '2026-05-05T10:00:00Z');
      await seedSummary(aMeeting, 'ready', 'התוכן הקליני של מטפל א׳');

      // B legitimately shares the patient: B has their OWN meeting + OWN ready summary.
      const bMeeting = await seedMeetingFor(otherUserId, patientId, '2026-06-05T10:00:00Z');
      await seedSummary(bMeeting, 'ready', 'התוכן הקליני של מטפל ב׳');

      // A generates and reads their report first.
      await request(httpServer)
        .post(pathFor(patientId))
        .set('Authorization', `Bearer ${token}`)
        .expect(202);
      const aReport = reportSchema.parse((await pollUntilSettled(patientId)).body);

      // B's POST must NOT clobber A's row; B operates on B's own row.
      await request(httpServer)
        .post(pathFor(patientId))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(202);
      const bReport = reportSchema.parse((await pollUntilSettledAs(patientId, otherToken)).body);

      // B's report is built from B's OWN summaries: only B's meeting id, B's excerpt.
      expect(bReport.status).toBe('ready');
      expect(bReport.source_meeting_ids).toEqual([bMeeting]);
      expect(bReport.source_meeting_ids).not.toContain(aMeeting);
      expect(bReport.last_summary_excerpt).toBe('התוכן הקליני של מטפל ב׳');
      expect(bReport.last_summary_excerpt).not.toBe('התוכן הקליני של מטפל א׳');

      // A's row survived B's POST unchanged — A still sees A's own meeting ids only.
      const aReread = reportSchema.parse(
        (
          await request(httpServer)
            .get(pathFor(patientId))
            .set('Authorization', `Bearer ${token}`)
            .expect(200)
        ).body,
      );
      expect(aReread.source_meeting_ids).toEqual(aReport.source_meeting_ids);
      expect(aReread.source_meeting_ids).toContain(aMeeting);
      expect(aReread.source_meeting_ids).not.toContain(bMeeting);
      expect(aReread.last_summary_excerpt).toBe('התוכן הקליני של מטפל א׳');
    });
  });
});
