// Patients CRUD against the real stack: Testcontainers Postgres + full app.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import type { JwtPayload } from '../src/auth/jwt-payload.interface';
import { AUTH_TYPE_PASSWORD, ROLE_THERAPIST } from '../src/auth/auth.constants';
import { createIntegrationApp, registerAndLogin, TestApp } from './utils/app-factory';

const patientSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  created_at: z.iso.datetime(),
  archived: z.boolean(),
});
const patientListSchema = z.array(patientSchema);

/**
 * TEMPORARY bootstrap — DELETE once the db-migration-runner unit lands (its
 * boot runner will apply migrations and record them in _migrations; this raw
 * apply intentionally skips that bookkeeping and gates only on the patients
 * table, so it must not outlive the runner). No-ops when the schema exists.
 */
async function ensureSchema(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const rows = await dataSource.query<Array<{ table_name: string | null }>>(
    "SELECT to_regclass('public.patients') AS table_name",
  );
  if (rows[0]?.table_name) return;
  const sql = await readFile(join(__dirname, '..', 'db', 'migrations', '0001_init.sql'), 'utf8');
  await dataSource.query(sql);
}

/**
 * Bearer token for the protected routes — real register+login when the auth
 * unit is merged; until then (TEMPORARY) seeds a user row and signs a token
 * through the app's own JwtModule so issuer/secret/claims match the strategy.
 * The fallback fires ONLY while /auth/register 404s (auth unit not merged);
 * any other register/login failure is a real bug and is rethrown.
 */
async function obtainToken(app: INestApplication): Promise<string> {
  try {
    return (await registerAndLogin(app)).token;
  } catch (error) {
    const authRoutesMissing = error instanceof Error && error.message.includes('got 404');
    if (!authRoutesMissing) throw error;
    const dataSource = app.get(DataSource);
    const userId = randomUUID();
    const email = `it-${randomUUID()}@test.local`;
    await dataSource.query(
      `INSERT INTO users (id, auth_type, role, email, full_name, password_hash)
       VALUES ($1, $2, $3, $4, 'Integration Test', 'not-a-real-hash')`,
      [userId, AUTH_TYPE_PASSWORD, ROLE_THERAPIST, email],
    );
    const payload: JwtPayload = {
      sub: userId,
      email,
      full_name: 'Integration Test',
      auth_type: AUTH_TYPE_PASSWORD,
      role: ROLE_THERAPIST,
      token_version: 0,
    };
    return app.get(JwtService).signAsync(payload);
  }
}

/** The app throttles 10 req/s — resetting the window per test keeps bursts legal. */
const THROTTLE_WINDOW_MS = 1100;

describe('patients (integration)', () => {
  let testApp: TestApp;
  let token: string;

  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_WINDOW_MS));
  });

  const randomCreateBody = (): { name: string; phone: string; email: string } => ({
    name: `patient-${randomUUID()}`,
    phone: '054-1234567',
    email: `p-${randomUUID()}@test.local`,
  });

  const auth = (value: string): [string, string] => ['Authorization', `Bearer ${value}`];

  async function createPatient(body: Record<string, unknown>): Promise<z.infer<typeof patientSchema>> {
    const response = await request(testApp.httpServer)
      .post('/patients')
      .set(...auth(token))
      .send(body)
      .expect(201);
    return patientSchema.parse(response.body);
  }

  async function listPatients(query = ''): Promise<z.infer<typeof patientListSchema>> {
    const response = await request(testApp.httpServer)
      .get(`/patients${query}`)
      .set(...auth(token))
      .expect(200);
    return patientListSchema.parse(response.body);
  }

  beforeAll(async () => {
    testApp = await createIntegrationApp();
    await ensureSchema(testApp.app);
    token = await obtainToken(testApp.app);
  }, 120_000);

  afterAll(async () => {
    await testApp.close();
  });

  describe('GET /patients', () => {
    it('401 without a token', async () => {
      await request(testApp.httpServer).get('/patients').expect(401);
    });

    it('lists active patients newest first (response shape)', async () => {
      const older = await createPatient(randomCreateBody());
      const newer = await createPatient(randomCreateBody());

      const patients = await listPatients();
      const ids = patients.map((patient) => patient.id);
      expect(ids).toContain(older.id);
      expect(ids).toContain(newer.id);
      expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));

      const times = patients.map((patient) => new Date(patient.created_at).getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });
  });

  describe('POST /patients', () => {
    it('201 creates an active patient (response shape)', async () => {
      const body = randomCreateBody();
      const created = await createPatient(body);
      expect(created).toMatchObject({ ...body, archived: false });
    });

    it('201 accepts an explicit null email', async () => {
      const created = await createPatient({ ...randomCreateBody(), email: null });
      expect(created.email).toBeNull();
    });

    it('400 on a missing phone', async () => {
      await request(testApp.httpServer)
        .post('/patients')
        .set(...auth(token))
        .send({ name: `patient-${randomUUID()}` })
        .expect(400);
    });

    it('400 on an invalid email', async () => {
      await request(testApp.httpServer)
        .post('/patients')
        .set(...auth(token))
        .send({ ...randomCreateBody(), email: 'not-an-email' })
        .expect(400);
    });

    it('401 without a token', async () => {
      await request(testApp.httpServer).post('/patients').send(randomCreateBody()).expect(401);
    });
  });

  describe('PATCH /patients/{id}', () => {
    it('200 updates fields and clears email on explicit null (response shape)', async () => {
      const created = await createPatient(randomCreateBody());
      const response = await request(testApp.httpServer)
        .patch(`/patients/${created.id}`)
        .set(...auth(token))
        .send({ phone: '052-9998877', email: null })
        .expect(200);

      const updated = patientSchema.parse(response.body);
      expect(updated).toMatchObject({
        id: created.id,
        name: created.name,
        phone: '052-9998877',
        email: null,
      });
    });

    it('archive → default list excludes → ?archived=true includes → restore', async () => {
      const created = await createPatient(randomCreateBody());

      const archiveResponse = await request(testApp.httpServer)
        .patch(`/patients/${created.id}`)
        .set(...auth(token))
        .send({ archived: true })
        .expect(200);
      expect(patientSchema.parse(archiveResponse.body).archived).toBe(true);

      const active = await listPatients();
      expect(active.map((patient) => patient.id)).not.toContain(created.id);

      const archived = await listPatients('?archived=true');
      const archivedIds = archived.map((patient) => patient.id);
      expect(archivedIds).toContain(created.id);
      expect(archived.every((patient) => patient.archived)).toBe(true);

      await request(testApp.httpServer)
        .patch(`/patients/${created.id}`)
        .set(...auth(token))
        .send({ archived: false })
        .expect(200);
      const restored = await listPatients();
      expect(restored.map((patient) => patient.id)).toContain(created.id);
    });

    it('400 on an empty body', async () => {
      const created = await createPatient(randomCreateBody());
      await request(testApp.httpServer)
        .patch(`/patients/${created.id}`)
        .set(...auth(token))
        .send({})
        .expect(400);
    });

    it('404 on an unknown uuid', async () => {
      await request(testApp.httpServer)
        .patch(`/patients/${randomUUID()}`)
        .set(...auth(token))
        .send({ phone: '050-0000000' })
        .expect(404);
    });

    it('401 without a token', async () => {
      await request(testApp.httpServer)
        .patch(`/patients/${randomUUID()}`)
        .send({ archived: true })
        .expect(401);
    });
  });

  describe('DELETE /patients/{id}', () => {
    it('204 deletes, then the id is gone (second delete 404)', async () => {
      const created = await createPatient(randomCreateBody());

      await request(testApp.httpServer)
        .delete(`/patients/${created.id}`)
        .set(...auth(token))
        .expect(204);

      const remaining = await listPatients();
      expect(remaining.map((patient) => patient.id)).not.toContain(created.id);

      await request(testApp.httpServer)
        .delete(`/patients/${created.id}`)
        .set(...auth(token))
        .expect(404);
    });

    it('404 on an unknown uuid', async () => {
      await request(testApp.httpServer)
        .delete(`/patients/${randomUUID()}`)
        .set(...auth(token))
        .expect(404);
    });

    it('400 on a malformed id', async () => {
      await request(testApp.httpServer)
        .delete('/patients/not-a-uuid')
        .set(...auth(token))
        .expect(400);
    });

    it('401 without a token', async () => {
      await request(testApp.httpServer).delete(`/patients/${randomUUID()}`).expect(401);
    });
  });
});
