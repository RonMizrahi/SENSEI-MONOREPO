// Health surface against the real stack: Testcontainers Postgres + full app.
import request from 'supertest';
import { z } from 'zod';
import { createIntegrationApp, TestApp } from './utils/app-factory';

const readinessSchema = z.object({
  status: z.string(),
  database: z.enum(['ok', 'unavailable', 'mock']),
});

describe('health (integration)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createIntegrationApp();
  }, 120_000);

  afterAll(async () => {
    await testApp.close();
  });

  it('GET / returns the welcome message', async () => {
    const response = await request(testApp.httpServer).get('/').expect(200);
    expect(response.body).toEqual({ message: 'Welcome to SenseiAPI' });
  });

  it('GET /health returns ok', async () => {
    const response = await request(testApp.httpServer).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /ready reports the database up', async () => {
    const response = await request(testApp.httpServer).get('/ready').expect(200);
    const parsed = readinessSchema.parse(response.body);
    expect(parsed.database).toBe('ok');
  });

  it('unknown routes 404 (no URI versioning)', async () => {
    await request(testApp.httpServer).get('/v1/health').expect(404);
  });
});
