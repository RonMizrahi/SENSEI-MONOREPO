// Audio upload/transcription flow against the real stack: Testcontainers
// Postgres + full app, with the ElevenLabs HTTP call stubbed via fetch.
// NOTE: the auth unit's /auth endpoints are built in parallel, so this suite
// seeds its user row directly and mints the Bearer token with the app's
// JwtService (same secret/issuer the JwtStrategy verifies).
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import type { JwtPayload } from '../src/auth/jwt-payload.interface';
import { User } from '../src/auth/entities/user.entity';
import { CalendarEvent } from '../src/calendar/entities/calendar-event.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { Transcript } from '../src/transcripts/entities/transcript.entity';
import { createIntegrationApp, TestApp } from './utils/app-factory';

const MAX_UPLOAD_BYTES_FOR_TEST = 64;
const HOUR_MS = 60 * 60 * 1000;

const STORED_AUDIO_ID = /^[0-9a-f]{32}\.[a-z0-9]{1,8}$/;

const uploadResponseSchema = z.object({
  id: z.string().regex(STORED_AUDIO_ID),
  filename: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int().positive(),
  language: z.string(),
  text: z.string().min(1),
  meeting_id: z.uuid(),
  transcript_id: z.uuid(),
});

const transcriptionResponseSchema = z.object({
  id: z.string().regex(STORED_AUDIO_ID),
  language: z.string(),
  text: z.string().min(1),
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })),
});

const SCRIBE_SUCCESS = {
  language_code: 'heb',
  text: 'שלום עולם',
  words: [
    { text: 'שלום', type: 'word', start: 0, end: 0.5 },
    { text: ' ', type: 'spacing', start: 0.5, end: 0.6 },
    { text: 'עולם', type: 'word', start: 0.6, end: 1.1 },
  ],
};

describe('audio (integration)', () => {
  let testApp: TestApp;
  let uploadDir: string;
  let dataSource: DataSource;
  let token: string;
  let therapistId: string;
  let otherToken: string;
  let otherTherapistId: string;
  let patientId: string;
  let otherPatientId: string;
  let fetchSpy: jest.SpyInstance;
  let scribeResponse: () => Response;
  let throttlerStorage: ThrottlerStorageService;

  /** Inserts a users row + signs a Bearer token for it (auth unit built in parallel). */
  async function seedTherapist(): Promise<{ token: string; id: string }> {
    const therapist = await dataSource.getRepository(User).save({
      authType: 'password',
      role: 'therapist',
      email: `it-${randomUUID()}@test.local`,
      fullName: 'Integration Therapist',
      passwordHash: 'irrelevant-for-jwt-auth',
      tokenVersion: 0,
    });
    const payload: JwtPayload = {
      sub: therapist.id,
      email: therapist.email,
      full_name: therapist.fullName,
      auth_type: therapist.authType,
      role: therapist.role,
      token_version: therapist.tokenVersion,
    };
    return { token: testApp.app.get(JwtService).sign(payload), id: therapist.id };
  }

  /** Inserts a calendar event owned by the given therapist and returns its id. */
  async function createMeetingFor(
    ownerTherapistId: string,
    linkedPatientId: string | null,
  ): Promise<string> {
    const now = Date.now();
    const meeting = await dataSource.getRepository(CalendarEvent).save({
      title: `פגישה ${randomUUID()}`,
      description: null,
      startAt: new Date(now),
      endAt: new Date(now + HOUR_MS),
      therapistId: ownerTherapistId,
      patientId: linkedPatientId,
    });
    return meeting.id;
  }

  /** Inserts a calendar event for the primary seeded therapist and returns its id. */
  function createMeeting(linkedPatientId: string | null): Promise<string> {
    return createMeetingFor(therapistId, linkedPatientId);
  }

  function uploadRequest(meetingId?: string): request.Test {
    const req = request(testApp.httpServer)
      .post('/audio/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('tiny-mp3-bytes'), {
        filename: 'session.mp3',
        contentType: 'audio/mpeg',
      });
    return meetingId === undefined ? req : req.field('meeting_id', meetingId);
  }

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'audio-int-'));
    testApp = await createIntegrationApp({
      UPLOAD_DIR: uploadDir,
      ELEVENLABS_API_KEY: 'int-test-key',
      MAX_UPLOAD_BYTES: String(MAX_UPLOAD_BYTES_FOR_TEST),
    });
    dataSource = testApp.app.get(DataSource);
    throttlerStorage = testApp.app.get<ThrottlerStorageService>(ThrottlerStorage);

    // The db unit's boot-time migration runner is built in parallel — apply the
    // foundation schema here when it has not been applied yet (idempotent).
    const applied = await dataSource.query<[{ applied: boolean }]>(
      "SELECT to_regclass('public.users') IS NOT NULL AS applied",
    );
    if (!applied[0].applied) {
      const migrationSql = await readFile(
        join(__dirname, '..', 'db', 'migrations', '0001_init.sql'),
        'utf8',
      );
      await dataSource.query(migrationSql);
    }

    ({ token, id: therapistId } = await seedTherapist());
    ({ token: otherToken, id: otherTherapistId } = await seedTherapist());

    const patients = dataSource.getRepository(Patient);
    patientId = (await patients.save({ name: 'דנה לוי', phone: '054-1234567', email: null })).id;
    otherPatientId = (
      await patients.save({ name: 'יוסי מזרחי', phone: '052-7654321', email: null })
    ).id;

    // Stub only the ElevenLabs call; everything else passes through.
    const realFetch = globalThis.fetch.bind(globalThis);
    scribeResponse = () => new Response(JSON.stringify(SCRIBE_SUCCESS), { status: 200 });
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((...args: Parameters<typeof fetch>) => {
        const [input, init] = args;
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('api.elevenlabs.io')) return Promise.resolve(scribeResponse());
        return realFetch(input, init);
      });
  }, 180_000);

  afterAll(async () => {
    fetchSpy?.mockRestore();
    await testApp.close();
  });

  beforeEach(() => {
    scribeResponse = () => new Response(JSON.stringify(SCRIBE_SUCCESS), { status: 200 });
    // The global rate limiter is not under test — keep sequential tests independent.
    throttlerStorage.storage.clear();
  });

  describe('POST /audio/upload', () => {
    it('transcribes, persists the transcript, deletes the file, and returns 201', async () => {
      const meetingId = await createMeeting(patientId);
      const response = await uploadRequest(meetingId).field('patient_id', patientId).expect(201);

      const body = uploadResponseSchema.parse(response.body);
      expect(body.meeting_id).toBe(meetingId);
      expect(body.text).toBe('שלום עולם');
      expect(body.language).toBe('he');

      const transcript = await dataSource.getRepository(Transcript).findOne({
        where: { meetingId },
      });
      expect(transcript?.id).toBe(body.transcript_id);
      expect(transcript?.diarizedSegments).toEqual([
        { speaker: 'unknown', start_time: 0, end_time: 0.5, text: 'שלום' },
        { speaker: 'unknown', start_time: 0.6, end_time: 1.1, text: 'עולם' },
      ]);

      // The recording is transient — nothing left in the upload dir.
      await expect(readdir(uploadDir)).resolves.toEqual([]);
    });

    it('rejects a second transcript for the same meeting with 409', async () => {
      const meetingId = await createMeeting(null);
      await uploadRequest(meetingId).expect(201);
      const response = await uploadRequest(meetingId).expect(409);
      expect(response.body).toMatchObject({ statusCode: 409, code: 'TRANSCRIPT_ALREADY_EXISTS' });
    });

    it('rejects an unknown meeting with 404', async () => {
      await uploadRequest(randomUUID()).expect(404);
    });

    it('rejects an unknown patient with 404', async () => {
      const meetingId = await createMeeting(null);
      await uploadRequest(meetingId).field('patient_id', randomUUID()).expect(404);
    });

    it('rejects a patient that does not match the meeting with 400', async () => {
      const meetingId = await createMeeting(patientId);
      await uploadRequest(meetingId).field('patient_id', otherPatientId).expect(400);
    });

    it('rejects a missing meeting_id with 400', async () => {
      await uploadRequest().expect(400);
    });

    it('rejects a non-audio file with 415', async () => {
      const meetingId = await createMeeting(null);
      await request(testApp.httpServer)
        .post('/audio/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('not audio'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .field('meeting_id', meetingId)
        .expect(415);
    });

    it('rejects an empty file with 400', async () => {
      const meetingId = await createMeeting(null);
      await request(testApp.httpServer)
        .post('/audio/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.alloc(0), { filename: 'empty.mp3', contentType: 'audio/mpeg' })
        .field('meeting_id', meetingId)
        .expect(400);
    });

    it('rejects an oversized file with 413', async () => {
      const meetingId = await createMeeting(null);
      await request(testApp.httpServer)
        .post('/audio/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.alloc(MAX_UPLOAD_BYTES_FOR_TEST + 1), {
          filename: 'big.mp3',
          contentType: 'audio/mpeg',
        })
        .field('meeting_id', meetingId)
        .expect(413);
    });

    it('maps a transcription provider failure to 502 and keeps the file for retry', async () => {
      scribeResponse = () => new Response('upstream down', { status: 500 });
      const meetingId = await createMeeting(null);
      await uploadRequest(meetingId).expect(502);

      const files = await readdir(uploadDir);
      expect(files).toHaveLength(1);

      // Clean up the stranded file for the suite's other assertions.
      await request(testApp.httpServer)
        .delete(`/audio/${files[0]}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('requires authentication (401 without a token)', async () => {
      await request(testApp.httpServer)
        .post('/audio/upload')
        .attach('file', Buffer.from('tiny'), { filename: 'a.mp3', contentType: 'audio/mpeg' })
        .field('meeting_id', randomUUID())
        .expect(401);
    });
  });

  describe('cross-therapist isolation (IDOR)', () => {
    /** Therapist B must never act on a meeting owned by therapist A. */
    it('404s when uploading against another therapist’s meeting (no transcript written)', async () => {
      const ownedByA = await createMeetingFor(therapistId, null);
      await request(testApp.httpServer)
        .post('/audio/upload')
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('file', Buffer.from('tiny-mp3-bytes'), {
          filename: 'session.mp3',
          contentType: 'audio/mpeg',
        })
        .field('meeting_id', ownedByA)
        .expect(404);

      // The foreign meeting stays untranscribed — owner A can still upload.
      await request(testApp.httpServer)
        .post('/audio/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('tiny-mp3-bytes'), {
          filename: 'session.mp3',
          contentType: 'audio/mpeg',
        })
        .field('meeting_id', ownedByA)
        .expect(201);
    });

    it('lets the owner upload against their own meeting (positive control)', async () => {
      const ownedByB = await createMeetingFor(otherTherapistId, null);
      await request(testApp.httpServer)
        .post('/audio/upload')
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('file', Buffer.from('tiny-mp3-bytes'), {
          filename: 'session.mp3',
          contentType: 'audio/mpeg',
        })
        .field('meeting_id', ownedByB)
        .expect(201);
    });
  });

  describe('stored-audio endpoints', () => {
    /** Strands one file in UPLOAD_DIR (upload whose transcription 502s) and returns its id. */
    async function strandFile(): Promise<string> {
      scribeResponse = () => new Response('upstream down', { status: 500 });
      await uploadRequest(await createMeeting(null)).expect(502);
      scribeResponse = () => new Response(JSON.stringify(SCRIBE_SUCCESS), { status: 200 });
      // No list endpoint by design — read the stranded file id straight off disk.
      const files = await readdir(uploadDir);
      expect(files).toHaveLength(1);
      return files[0];
    }

    it('GET /audio/{id} downloads the raw bytes; DELETE removes them', async () => {
      const audioId = await strandFile();

      const download = await request(testApp.httpServer)
        .get(`/audio/${audioId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('content-type', /audio\/mpeg/);
      expect((download.body as Buffer).toString()).toBe('tiny-mp3-bytes');

      await request(testApp.httpServer)
        .delete(`/audio/${audioId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      await request(testApp.httpServer)
        .delete(`/audio/${audioId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('GET /audio is not a route — the raw-file enumeration vector is gone (404)', async () => {
      await request(testApp.httpServer)
        .get('/audio')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('rejects path-traversal ids with 404', async () => {
      await request(testApp.httpServer)
        .get('/audio/..%2F0001_init.sql')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      await request(testApp.httpServer)
        .delete('/audio/not-a-stored-id.mp3')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('POST /audio/{id}/transcribe transcribes a stored file and deletes it', async () => {
      const audioId = await strandFile();

      const response = await request(testApp.httpServer)
        .post(`/audio/${audioId}/transcribe`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = transcriptionResponseSchema.parse(response.body);
      expect(body.id).toBe(audioId);
      expect(body.words.length).toBeGreaterThan(0);

      await request(testApp.httpServer)
        .post(`/audio/${audioId}/transcribe`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('POST /audio/{id}/transcribe maps provider failures to 502', async () => {
      const audioId = await strandFile();
      scribeResponse = () => new Response('still down', { status: 500 });
      await request(testApp.httpServer)
        .post(`/audio/${audioId}/transcribe`)
        .set('Authorization', `Bearer ${token}`)
        .expect(502);
      // retry still possible — clean up
      await request(testApp.httpServer)
        .delete(`/audio/${audioId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });
});
