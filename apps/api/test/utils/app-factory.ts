import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../../src/app.setup';
import { provisionDatabase } from './shared-postgres';

const DEFAULT_TEST_PASSWORD = 'test-password-1234';

/** A booted test app plus the resources to tear down. */
export interface TestApp {
  app: INestApplication;
  /** Typed HTTP server handle for supertest. */
  httpServer: App;
  /** The database URI this app booted against (reuse it to re-boot the same DB). */
  databaseUrl: string;
  /** Stops the app and drops this suite's isolated database (no-op drop when reusing). */
  close(): Promise<void>;
}

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
 * Imports AppModule AFTER env is set — module composition reads MOCK_MODE at
 * import time. Node's require cache means ONE mode per test file: never mix
 * createIntegrationApp and createMockApp in the same *.int-spec.ts.
 * Boot ONE app at a time and await close() before booting another — the env
 * snapshot/restore in applyEnv is only correct for strictly sequential apps.
 */
async function bootApp(): Promise<INestApplication> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../../src/app.module') as {
    AppModule: new () => unknown;
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Boots the full app against a fresh Testcontainers Postgres (SQL migrations run at boot).
 * @param env Extra env overrides applied before module composition.
 */
export async function createIntegrationApp(env: Record<string, string> = {}): Promise<TestApp> {
  // Reuse a caller-supplied DATABASE_URL (re-boot the same DB); otherwise provision a fresh one.
  const database = env.DATABASE_URL ? null : await provisionDatabase();
  const databaseUrl = env.DATABASE_URL ?? database!.uri;
  const restore = applyEnv({
    MOCK_MODE: 'false',
    DATABASE_URL: databaseUrl,
    LOG_LEVEL: 'fatal',
    // Deterministic gate: never inherit the developer's .env SEED_DEMO_DATA. Tests
    // that want the demo seed pass SEED_DEMO_DATA: 'true' explicitly (it wins here).
    SEED_DEMO_DATA: 'false',
    ...env,
  });
  const app = await bootApp();
  return {
    app,
    httpServer: app.getHttpServer() as App,
    databaseUrl,
    close: async () => {
      await app.close();
      restore();
      if (database) await database.drop();
    },
  };
}

/**
 * Boots the full app in MOCK_MODE (seeded in-memory, no database).
 * @param env Extra env overrides applied before module composition.
 */
export async function createMockApp(env: Record<string, string> = {}): Promise<TestApp> {
  const restore = applyEnv({ MOCK_MODE: 'true', LOG_LEVEL: 'fatal', ...env });
  const app = await bootApp();
  return {
    app,
    httpServer: app.getHttpServer() as App,
    close: async () => {
      await app.close();
      restore();
    },
  };
}

/**
 * Registers a fresh random user and returns a Bearer token for it.
 * @returns The token plus the generated credentials.
 */
export async function registerAndLogin(
  app: INestApplication,
): Promise<{ token: string; email: string; password: string }> {
  const email = `it-${crypto.randomUUID()}@test.local`;
  const password = DEFAULT_TEST_PASSWORD;
  await request(app.getHttpServer() as App)
    .post('/auth/register')
    .send({ email, password, full_name: 'Integration Test' })
    .expect(201);
  const tokenResponse = await request(app.getHttpServer() as App)
    .post('/auth/token')
    .type('form')
    .send({ username: email, password })
    .expect(200);
  return { token: (tokenResponse.body as { access_token: string }).access_token, email, password };
}
