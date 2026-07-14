// Full /auth contract against the real stack: Testcontainers Postgres + argon2 + JWT.
import type { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { createIntegrationApp, registerAndLogin, TestApp } from './utils/app-factory';

const registerResponseSchema = z.object({
  user_id: z.uuid(),
  auth_type: z.literal('password'),
  role: z.literal('therapist'),
  email: z.string(),
  full_name: z.string().nullable(),
  created_at: z.iso.datetime(),
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('bearer'),
});

const whoamiResponseSchema = z.object({
  user_id: z.uuid(),
  email: z.string(),
  full_name: z.string().nullable(),
});

/**
 * Applies 0001_init.sql when the schema is absent — the boot-time SQL runner is
 * the db unit's deliverable; this keeps the auth suite green before and after it lands.
 */
async function ensureSchema(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const existing = await dataSource.query<{ users_table: string | null }[]>(
    "SELECT to_regclass('public.users') AS users_table",
  );
  if (existing[0].users_table === null) {
    const migrationPath = join(__dirname, '..', 'db', 'migrations', '0001_init.sql');
    await dataSource.query(readFileSync(migrationPath, 'utf8'));
  }
}

function randomCredentials(): { email: string; password: string } {
  return { email: `auth-${crypto.randomUUID()}@test.local`, password: 'integration-pass-1' };
}

describe('auth (integration)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createIntegrationApp();
    await ensureSchema(testApp.app);
  }, 180_000);

  afterAll(async () => {
    await testApp.close();
  });

  it('register → token (urlencoded) → whoami → logout → old token 401', async () => {
    const { email, password } = randomCredentials();

    const registered = await request(testApp.httpServer)
      .post('/auth/register')
      .send({ email, password, full_name: 'Journey Test' })
      .expect(201);
    const registeredBody = registerResponseSchema.parse(registered.body);
    expect(registeredBody.email).toBe(email);
    expect(registeredBody.full_name).toBe('Journey Test');

    const tokenResponse = await request(testApp.httpServer)
      .post('/auth/token')
      .type('form')
      .send({ username: email, password })
      .expect(200);
    const { access_token } = tokenResponseSchema.parse(tokenResponse.body);

    const whoami = await request(testApp.httpServer)
      .get('/auth/whoami')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);
    const identity = whoamiResponseSchema.parse(whoami.body);
    expect(identity).toEqual({
      user_id: registeredBody.user_id,
      email,
      full_name: 'Journey Test',
    });

    await request(testApp.httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(204);

    await request(testApp.httpServer)
      .get('/auth/whoami')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(401);
  });

  it('registers with a normalized email and 409s on a duplicate (case-insensitive)', async () => {
    const { email, password } = randomCredentials();
    const mixedCase = email.toUpperCase();

    const registered = await request(testApp.httpServer)
      .post('/auth/register')
      .send({ email: mixedCase, password })
      .expect(201);
    expect(registerResponseSchema.parse(registered.body).email).toBe(email);

    await request(testApp.httpServer)
      .post('/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('400s a register with a short password or invalid email', async () => {
    const { email } = randomCredentials();
    await request(testApp.httpServer)
      .post('/auth/register')
      .send({ email, password: '1234567' })
      .expect(400);
    await request(testApp.httpServer)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'integration-pass-1' })
      .expect(400);
  });

  it('401s a token request with a wrong password or unknown user', async () => {
    const { email, password } = randomCredentials();
    await request(testApp.httpServer).post('/auth/register').send({ email, password }).expect(201);

    await request(testApp.httpServer)
      .post('/auth/token')
      .type('form')
      .send({ username: email, password: 'wrong-password-1' })
      .expect(401);
    await request(testApp.httpServer)
      .post('/auth/token')
      .type('form')
      .send({ username: `ghost-${crypto.randomUUID()}@test.local`, password })
      .expect(401);
  });

  it('401s protected endpoints without a token (no MOCK_MODE bypass here)', async () => {
    await request(testApp.httpServer).get('/auth/whoami').expect(401);
    await request(testApp.httpServer).post('/auth/logout').expect(401);
    await request(testApp.httpServer)
      .post('/auth/password/change')
      .send({ current_password: 'x', new_password: 'integration-pass-2' })
      .expect(401);
  });

  it('password change revokes old tokens and swaps the accepted password', async () => {
    const { token, email, password } = await registerAndLogin(testApp.app);
    const newPassword = `np-${crypto.randomUUID()}`;

    await request(testApp.httpServer)
      .post('/auth/password/change')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'definitely-wrong-1', new_password: newPassword })
      .expect(401);

    await request(testApp.httpServer)
      .post('/auth/password/change')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: password, new_password: newPassword })
      .expect(204);

    // the pre-change token is revoked...
    await request(testApp.httpServer)
      .get('/auth/whoami')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    // ...the old password no longer authenticates...
    await request(testApp.httpServer)
      .post('/auth/token')
      .type('form')
      .send({ username: email, password })
      .expect(401);
    // ...and the new password mints a working token.
    const reissued = await request(testApp.httpServer)
      .post('/auth/token')
      .type('form')
      .send({ username: email, password: newPassword })
      .expect(200);
    const { access_token } = tokenResponseSchema.parse(reissued.body);
    await request(testApp.httpServer)
      .get('/auth/whoami')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);
  });
});
