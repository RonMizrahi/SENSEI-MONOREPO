// Calendar CRUD against the real stack: Testcontainers Postgres + full app.
//
// The auth endpoints (unit 2) and the boot-time migration runner (unit 1) are
// separate work units, so this file provisions its own prerequisites in a way
// that stays correct after they land: the frozen 0001_init.sql is applied only
// when the schema is missing, therapists are inserted as real `users` rows
// (token_version 0), and Bearer tokens are minted through the app's JwtModule
// (issuer/claims per the frozen JwtPayload contract).
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import type { JwtPayload } from '../src/auth/jwt-payload.interface';
import { createIntegrationApp, TestApp } from './utils/app-factory';

const IL = 'Asia/Jerusalem';
// stay under the global 10 req/s throttle window
const THROTTLE_SPACING_MS = 150;

const eventSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    start_at: z.iso.datetime({ offset: true }),
    end_at: z.iso.datetime({ offset: true }),
    created_at: z.iso.datetime({ offset: true }),
    therapist_id: z.uuid(),
    patient_id: z.uuid().nullable(),
  })
  .strict();

interface Therapist {
  id: string;
  token: string;
}

describe('calendar (integration)', () => {
  let testApp: TestApp;
  let therapistA: Therapist;
  let therapistB: Therapist;

  /** Applies 0001_init.sql when the schema is absent (pre-migration-runner worlds). */
  async function ensureSchema(): Promise<void> {
    const dataSource = testApp.app.get(DataSource);
    const check = await dataSource.query<Array<{ applied: boolean }>>(
      "SELECT to_regclass('public.calendar_events') IS NOT NULL AS applied",
    );
    if (check[0]?.applied) return;
    const sql = readFileSync(join(__dirname, '..', 'db', 'migrations', '0001_init.sql'), 'utf8');
    await dataSource.query(sql);
  }

  /** Inserts a random therapist row and mints a Bearer token for it. */
  async function createTherapist(): Promise<Therapist> {
    const id = randomUUID();
    const email = `it-${randomUUID()}@test.local`;
    const dataSource = testApp.app.get(DataSource);
    await dataSource.query(
      `INSERT INTO users (id, auth_type, role, email, full_name, password_hash, token_version)
       VALUES ($1, 'password', 'therapist', $2, 'Calendar IT', 'unused-hash', 0)`,
      [id, email],
    );
    const payload: JwtPayload = {
      sub: id,
      email,
      full_name: 'Calendar IT',
      auth_type: 'password',
      role: 'therapist',
      token_version: 0,
    };
    return { id, token: testApp.app.get(JwtService).sign({ ...payload }) };
  }

  /** POSTs a valid event as the given therapist and returns the response body. */
  async function createEvent(
    therapist: Therapist,
    overrides: Record<string, unknown> = {},
  ): Promise<z.infer<typeof eventSchema>> {
    const response = await request(testApp.httpServer)
      .post(`/calendar?time_zone=${IL}`)
      .set('Authorization', `Bearer ${therapist.token}`)
      .send({
        title: 'פגישה שבועית',
        description: 'תיאור',
        start_at: '2026-08-10T10:00:00',
        end_at: '2026-08-10T10:50:00',
        ...overrides,
      })
      .expect(201);
    return eventSchema.parse(response.body);
  }

  beforeAll(async () => {
    testApp = await createIntegrationApp();
    await ensureSchema();
    therapistA = await createTherapist();
    therapistB = await createTherapist();
  }, 120_000);

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_SPACING_MS));
  });

  describe('POST /calendar', () => {
    it('creates an event owned by the caller, rendered in the requested zone', async () => {
      const body = await createEvent(therapistA);
      expect(body.therapist_id).toBe(therapistA.id);
      expect(body.start_at).toBe('2026-08-10T10:00:00.000+03:00');
      expect(body.end_at).toBe('2026-08-10T10:50:00.000+03:00');
      expect(body.description).toBe('תיאור');
      expect(body.patient_id).toBeNull();
    });

    it('ignores a client-supplied therapist_id (always the caller)', async () => {
      const body = await createEvent(therapistA, { therapist_id: therapistB.id });
      expect(body.therapist_id).toBe(therapistA.id);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(testApp.httpServer)
        .post('/calendar')
        .send({ title: 'x', start_at: '2026-08-10T10:00:00', end_at: '2026-08-10T10:50:00' })
        .expect(401);
    });

    it('rejects a missing title with 400', async () => {
      await request(testApp.httpServer)
        .post('/calendar')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .send({ start_at: '2026-08-10T10:00:00', end_at: '2026-08-10T10:50:00' })
        .expect(400);
    });

    it('rejects an invalid time_zone with 400', async () => {
      await request(testApp.httpServer)
        .post('/calendar?time_zone=Not/AZone')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .send({ title: 'x', start_at: '2026-08-10T10:00:00', end_at: '2026-08-10T10:50:00' })
        .expect(400);
    });

    it('rejects an inverted interval (end_at before start_at) with 400', async () => {
      await request(testApp.httpServer)
        .post('/calendar')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .send({ title: 'הפוך', start_at: '2026-08-10T10:50:00', end_at: '2026-08-10T10:00:00' })
        .expect(400);
    });
  });

  describe('GET /calendar', () => {
    it('lists events overlapping the requested window', async () => {
      const created = await createEvent(therapistA);
      const response = await request(testApp.httpServer)
        .get(`/calendar?from=2026-08-09&to=2026-08-15&time_zone=${IL}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(200);
      const events = z.array(eventSchema).parse(response.body);
      expect(events.map((event) => event.id)).toContain(created.id);
      expect(events.every((event) => event.therapist_id === therapistA.id)).toBe(true);
    });

    it('defaults to the current week when no bounds are given', async () => {
      // spans "now" so the event overlaps the server-resolved week even if the
      // suite crosses a week boundary between creation and listing
      const now = DateTime.now().setZone(IL);
      const created = await createEvent(therapistA, {
        start_at: now.minus({ minutes: 1 }).toISO(),
        end_at: now.plus({ days: 1 }).toISO(),
      });
      const response = await request(testApp.httpServer)
        .get('/calendar')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(200);
      const events = z.array(eventSchema).parse(response.body);
      expect(events.map((event) => event.id)).toContain(created.id);
    });

    it('rejects from > to with 400', async () => {
      await request(testApp.httpServer)
        .get('/calendar?from=2026-08-15&to=2026-08-09')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(400);
    });

    it('rejects a window longer than 365 days with 400', async () => {
      await request(testApp.httpServer)
        .get('/calendar?from=2026-01-01&to=2027-01-02')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(400);
    });

    it('rejects a malformed from date with 400', async () => {
      await request(testApp.httpServer)
        .get('/calendar?from=2026-13-01&to=2026-08-15')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(testApp.httpServer).get('/calendar').expect(401);
    });
  });

  describe('GET /calendar/{id}', () => {
    it('returns the caller’s event', async () => {
      const created = await createEvent(therapistA);
      const response = await request(testApp.httpServer)
        .get(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(200);
      expect(eventSchema.parse(response.body).id).toBe(created.id);
    });

    it('returns 404 for an unknown id', async () => {
      await request(testApp.httpServer)
        .get(`/calendar/${randomUUID()}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(testApp.httpServer)
        .get('/calendar/not-a-uuid')
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(400);
    });
  });

  describe('PATCH /calendar/{id}', () => {
    it('applies a partial update and re-renders times in the zone', async () => {
      const created = await createEvent(therapistA);
      const response = await request(testApp.httpServer)
        .patch(`/calendar/${created.id}?time_zone=${IL}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .send({ title: 'עודכן', start_at: '2026-08-10T10:20:00' })
        .expect(200);
      const updated = eventSchema.parse(response.body);
      expect(updated.title).toBe('עודכן');
      expect(updated.start_at).toBe('2026-08-10T10:20:00.000+03:00');
      expect(updated.end_at).toBe(created.end_at);
    });

    it('rejects an empty update body with 400', async () => {
      const created = await createEvent(therapistA);
      await request(testApp.httpServer)
        .patch(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .send({})
        .expect(400);
    });

    it('rejects an inverted interval against the stored bound with 400', async () => {
      // stored 10:00–10:50; moving end_at before the stored start inverts it
      const created = await createEvent(therapistA);
      await request(testApp.httpServer)
        .patch(`/calendar/${created.id}?time_zone=${IL}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .send({ end_at: '2026-08-10T09:00:00' })
        .expect(400);
    });

    it('returns 404 for an unknown id', async () => {
      await request(testApp.httpServer)
        .patch(`/calendar/${randomUUID()}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .send({ title: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /calendar/{id}', () => {
    it('deletes the caller’s event and subsequent reads 404', async () => {
      const created = await createEvent(therapistA);
      await request(testApp.httpServer)
        .delete(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(204);
      await request(testApp.httpServer)
        .get(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(404);
    });

    it('returns 404 for an unknown id', async () => {
      await request(testApp.httpServer)
        .delete(`/calendar/${randomUUID()}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(testApp.httpServer).delete(`/calendar/${randomUUID()}`).expect(401);
    });
  });

  describe('cross-therapist isolation', () => {
    it('hides one therapist’s event from another (404 on read/update/delete)', async () => {
      const created = await createEvent(therapistA);
      await request(testApp.httpServer)
        .get(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistB.token}`)
        .expect(404);
      await request(testApp.httpServer)
        .patch(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistB.token}`)
        .send({ title: 'פריצה' })
        .expect(404);
      await request(testApp.httpServer)
        .delete(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistB.token}`)
        .expect(404);
      // still intact and untouched for the owner
      const response = await request(testApp.httpServer)
        .get(`/calendar/${created.id}`)
        .set('Authorization', `Bearer ${therapistA.token}`)
        .expect(200);
      expect(eventSchema.parse(response.body).title).toBe(created.title);
    });

    it('excludes other therapists’ events from listings', async () => {
      const created = await createEvent(therapistA);
      const response = await request(testApp.httpServer)
        .get('/calendar?from=2026-08-09&to=2026-08-15')
        .set('Authorization', `Bearer ${therapistB.token}`)
        .expect(200);
      const events = z.array(eventSchema).parse(response.body);
      expect(events.map((event) => event.id)).not.toContain(created.id);
    });
  });
});
