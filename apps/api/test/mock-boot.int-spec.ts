// MOCK_MODE boot: the whole app must come up with no database and report mock readiness.
import request from 'supertest';
import { createMockApp, TestApp } from './utils/app-factory';

describe('mock-mode boot (integration)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createMockApp();
  }, 60_000);

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /ready reports the mock database', async () => {
    const response = await request(testApp.httpServer).get('/ready').expect(200);
    expect(response.body).toEqual({ status: 'ready', database: 'mock' });
  });
});
