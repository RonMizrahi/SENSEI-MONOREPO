// Summaries surface against the real stack: Testcontainers Postgres + full app,
// with the SUMMARIZER overridden by a deterministic stub (a local boot helper is
// used because the shared factory cannot override providers — test/utils is frozen).
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { configureApp } from '../src/app.setup';
import { SUMMARIZER } from '../src/summaries/summarizer.interface';
import type { Summarizer, SummaryResult } from '../src/summaries/summarizer.interface';
import { TRANSCRIPT_READER } from '../src/transcripts/transcript-reader';
import type { TranscriptReader } from '../src/transcripts/transcript-reader';
import type { Transcript } from '../src/transcripts/entities/transcript.entity';

const STUB_SUMMARY_TEXT = 'סיכום בדיקה — נוצר על ידי סטאב דטרמיניסטי';
const STUB_MODEL = 'stub-model';
const FAIL_MARKER = 'FAIL_SUMMARY';
const STUB_FAILURE = 'stub summarizer failure';
const POLL_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 200;

/** Deterministic summarizer — fails when the transcript carries the marker. */
const stubSummarizer: Summarizer = {
  summarize(text: string): Promise<SummaryResult> {
    if (text.includes(FAIL_MARKER)) return Promise.reject(new Error(STUB_FAILURE));
    return Promise.resolve({ text: STUB_SUMMARY_TEXT, model: STUB_MODEL });
  },
};

const summarySchema = z.object({
  meeting_id: z.string().uuid(),
  status: z.enum(['pending', 'running', 'ready', 'failed']),
  text: z.string().nullable(),
  model: z.string().nullable(),
  error: z.string().nullable(),
});

describe('summaries (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let httpServer: App;
  let dataSource: DataSource;
  let token: string;
  let therapistId: string;
  let otherToken: string;
  let throttlerStorage: ThrottlerStorageService;
  const previousEnv = new Map<string, string | undefined>();

  // DB-backed stand-in for the audio-transcription unit's TRANSCRIPT_READER
  // (this worktree only has the foundation's no-op binding).
  const dbTranscriptReader: TranscriptReader = {
    async getByMeetingId(meetingId: string): Promise<Transcript | null> {
      const rows: Array<{ raw_text: string }> = await dataSource.query(
        'SELECT raw_text FROM transcripts WHERE meeting_id = $1',
        [meetingId],
      );
      if (rows.length === 0) return null;
      return { meetingId, rawText: rows[0].raw_text, language: 'he' } as Transcript;
    },
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();
    for (const [key, value] of Object.entries({
      MOCK_MODE: 'false',
      DATABASE_URL: container.getConnectionUri(),
      LOG_LEVEL: 'fatal',
    })) {
      previousEnv.set(key, process.env[key]);
      process.env[key] = value;
    }

    // AppModule composes on MOCK_MODE at import time — require AFTER env is set.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../src/app.module') as { AppModule: new () => unknown };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUMMARIZER)
      .useValue(stubSummarizer)
      .overrideProvider(TRANSCRIPT_READER)
      .useValue(dbTranscriptReader)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    httpServer = app.getHttpServer() as App;
    dataSource = app.get(DataSource);

    throttlerStorage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    await applySchemaIfMissing(dataSource);
    ({ token, therapistId } = await seedTherapist(app, dataSource));
    ({ token: otherToken } = await seedTherapist(app, dataSource));
  }, 180_000);

  beforeEach(() => {
    // The global rate limiter is not under test — keep sequential tests independent.
    throttlerStorage.storage.clear();
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /** Applies 0001_init.sql when the migration runner has not created the schema yet. */
  async function applySchemaIfMissing(source: DataSource): Promise<void> {
    const existing: Array<{ reg: string | null }> = await source.query(
      "SELECT to_regclass('public.users') AS reg",
    );
    if (existing[0]?.reg) return;
    const sql = readFileSync(join(__dirname, '../db/migrations/0001_init.sql'), 'utf8');
    await source.query(sql);
  }

  /** Inserts a therapist row and mints a Bearer token for it through the app's JwtModule. */
  async function seedTherapist(
    application: INestApplication,
    source: DataSource,
  ): Promise<{ token: string; therapistId: string }> {
    const userId = crypto.randomUUID();
    const email = `it-${crypto.randomUUID()}@test.local`;
    await source.query(
      `INSERT INTO users (id, auth_type, role, email, full_name, password_hash)
       VALUES ($1, 'password', 'therapist', $2, 'Integration Therapist', 'not-a-real-hash')`,
      [userId, email],
    );
    const jwt = application.get(JwtService);
    const bearer = jwt.sign({
      sub: userId,
      email,
      full_name: 'Integration Therapist',
      auth_type: 'password',
      role: 'therapist',
      token_version: 0,
    });
    return { token: bearer, therapistId: userId };
  }

  /** Inserts a meeting (calendar event) owned by the seeded therapist. */
  async function insertMeeting(): Promise<string> {
    const id = crypto.randomUUID();
    await dataSource.query(
      `INSERT INTO calendar_events (id, title, start_at, end_at, therapist_id)
       VALUES ($1, 'פגישת בדיקה', now(), now() + interval '50 minutes', $2)`,
      [id, therapistId],
    );
    return id;
  }

  /** Inserts a transcript row for the meeting. */
  async function insertTranscript(meetingId: string, rawText: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO transcripts (id, meeting_id, raw_text) VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), meetingId, rawText],
    );
  }

  /** Polls GET /meetings/{id}/summary until the status is terminal (ready/failed). */
  async function pollUntilTerminal(meetingId: string): Promise<z.infer<typeof summarySchema>> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const response = await request(httpServer)
        .get(`/meetings/${meetingId}/summary`)
        .set('Authorization', `Bearer ${token}`);
      const body = summarySchema.parse(response.body);
      if (body.status === 'ready' || body.status === 'failed') {
        expect(response.status).toBe(200);
        return body;
      }
      expect(response.status).toBe(202);
      if (Date.now() > deadline) {
        throw new Error(`summary for ${meetingId} still ${body.status} after timeout`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  it('rejects unauthenticated access with 401', async () => {
    await request(httpServer).get(`/meetings/${crypto.randomUUID()}/summary`).expect(401);
    await request(httpServer).post(`/meetings/${crypto.randomUUID()}/summary`).expect(401);
  });

  it('GET returns 404 when no summary row exists', async () => {
    await request(httpServer)
      .get(`/meetings/${crypto.randomUUID()}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('POST returns 404 for a meeting that does not exist', async () => {
    await request(httpServer)
      .post(`/meetings/${crypto.randomUUID()}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('404 → POST 202 pending → GET 200 ready with the stubbed text (happy path)', async () => {
    const meetingId = await insertMeeting();
    await insertTranscript(meetingId, 'המטופל דיבר על התמודדות עם לחץ בעבודה.');

    await request(httpServer)
      .get(`/meetings/${meetingId}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const queued = await request(httpServer)
      .post(`/meetings/${meetingId}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202);
    const pendingBody = summarySchema.parse(queued.body);
    expect(pendingBody).toEqual({
      meeting_id: meetingId,
      status: 'pending',
      text: null,
      model: null,
      error: null,
    });

    const done = await pollUntilTerminal(meetingId);
    expect(done.status).toBe('ready');
    expect(done.text).toBe(STUB_SUMMARY_TEXT);
    expect(done.model).toBe(STUB_MODEL);
    expect(done.error).toBeNull();
  });

  it('a summarizer failure lands on the row and is served with 200 failed', async () => {
    const meetingId = await insertMeeting();
    await insertTranscript(meetingId, `תמליל עם ${FAIL_MARKER} שמפיל את הסטאב`);

    await request(httpServer)
      .post(`/meetings/${meetingId}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    const done = await pollUntilTerminal(meetingId);
    expect(done.status).toBe('failed');
    expect(done.error).toBe(STUB_FAILURE);
    expect(done.text).toBeNull();
  });

  it('a meeting without a transcript fails with a clear error', async () => {
    const meetingId = await insertMeeting();

    await request(httpServer)
      .post(`/meetings/${meetingId}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    const done = await pollUntilTerminal(meetingId);
    expect(done.status).toBe('failed');
    expect(done.error).toBe('no transcript for this meeting');
  });

  it('re-queueing a failed summary resets it and reaches ready once a transcript exists', async () => {
    const meetingId = await insertMeeting();

    await request(httpServer)
      .post(`/meetings/${meetingId}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202);
    const failed = await pollUntilTerminal(meetingId);
    expect(failed.status).toBe('failed');

    await insertTranscript(meetingId, 'תמליל שנוסף לאחר הכישלון הראשון.');
    await request(httpServer)
      .post(`/meetings/${meetingId}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    const done = await pollUntilTerminal(meetingId);
    expect(done.status).toBe('ready');
    expect(done.text).toBe(STUB_SUMMARY_TEXT);
  });

  describe('cross-therapist isolation (IDOR)', () => {
    // therapist A owns the meeting + summary; therapist B (otherToken) is a foreign caller.
    it('B gets 404 on GET for A’s ready summary; A (owner) gets 200', async () => {
      const meetingId = await insertMeeting();
      await insertTranscript(meetingId, 'תמליל של מטפל א׳.');
      await request(httpServer)
        .post(`/meetings/${meetingId}/summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(202);
      await pollUntilTerminal(meetingId);

      await request(httpServer)
        .get(`/meetings/${meetingId}/summary`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      // owner still reads it (positive control)
      await request(httpServer)
        .get(`/meetings/${meetingId}/summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('B gets 404 on POST (re-queue) for A’s meeting', async () => {
      const meetingId = await insertMeeting();
      await request(httpServer)
        .post(`/meetings/${meetingId}/summary`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });
});
