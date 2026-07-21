// Assistant endpoints (MOCK_MODE): context views + the streaming chat wiring.
// Logic breadth lives in the unit specs; this asserts per-endpoint wiring — status,
// auth, validation, and the AI-SDK stream contract.
import request from 'supertest';
import { createMockApp, registerAndLogin, TestApp } from './utils/app-factory';

describe('assistant (integration, mock mode)', () => {
  let testApp: TestApp;
  let token: string;

  beforeAll(async () => {
    testApp = await createMockApp({ ASSISTANT_ENABLED: 'true' });
    ({ token } = await registerAndLogin(testApp.app));
  }, 60_000);

  afterAll(async () => {
    await testApp.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  describe('context endpoints', () => {
    it('GET /assistant/context/patients returns the roster (name-only shape)', async () => {
      const res = await request(testApp.httpServer).get('/assistant/context/patients').set(auth()).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const p of res.body as Array<Record<string, unknown>>) {
        expect(Object.keys(p).sort()).toEqual(['id', 'name']);
      }
    });

    it('GET /assistant/context/agenda returns a list', async () => {
      const res = await request(testApp.httpServer).get('/assistant/context/agenda?days=7').set(auth()).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('rejects an out-of-range agenda window (400)', async () => {
      await request(testApp.httpServer).get('/assistant/context/agenda?days=999').set(auth()).expect(400);
    });

    it('rejects a malformed patient id (400)', async () => {
      await request(testApp.httpServer).get('/assistant/context/patient/not-a-uuid/cadence').set(auth()).expect(400);
    });
    // Note: MOCK_MODE resolves anonymous requests to the seeded TEST_USER
    // (senseiAPI ENABLE_SECURITY=false parity), so the global JwtAuthGuard's 401
    // path is exercised by the secured integration suites, not here.
  });

  describe('POST /assistant/chat', () => {
    it('rejects an empty question (422)', async () => {
      await request(testApp.httpServer)
        .post('/assistant/chat')
        .set(auth())
        .send({ messages: [] })
        .expect(422);
    });

    it('streams a valid AI-SDK UI Message Stream', async () => {
      const res = await request(testApp.httpServer)
        .post('/assistant/chat')
        .set(auth())
        .send({ messages: [{ role: 'user', parts: [{ type: 'text', text: 'שלום' }] }] })
        .expect(200);

      expect(res.headers['x-vercel-ai-ui-message-stream']).toBe('v1');
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('data: {"type":"start"}');
      expect(res.text).toContain('"type":"text-delta"');
      expect(res.text.trim().endsWith('data: [DONE]')).toBe(true);
    });
  });
});
