// Demo-seed gating (integration): with SEED_DEMO_DATA=true the boot-time seed
// migrations materialize the demo therapist + roster + appointments, and the SPA's
// login flow (demo1234) fetches them; with the flag off, nothing is seeded. ONE
// mode per file: integration (MOCK_MODE=false), a fresh DB provisioned per app.
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { createIntegrationApp, TestApp } from './utils/app-factory';

const DEMO_EMAIL = 'rotem@clinic.co.il';
const DEMO_PASSWORD = 'demo1234';
const DEMO_THERAPIST_ID = '00000000-0000-4000-8000-000000000001';
const SEEDED_PATIENT_COUNT = 4;
const SEEDED_APPOINTMENT_COUNT = 8;
const CALENDAR_WINDOW_DAYS = 14;

const whoamiSchema = z.object({
  user_id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
});
const patientListSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    phone: z.string(),
    email: z.string().nullable(),
    created_at: z.iso.datetime(),
    archived: z.boolean(),
  }),
);
const calendarListSchema = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    start_at: z.string(),
    end_at: z.string(),
    created_at: z.string(),
    therapist_id: z.uuid(),
    patient_id: z.uuid().nullable(),
  }),
);

/** YYYY-MM-DD `days` from today, for the /calendar from/to window. */
function isoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Logs in as the seeded demo therapist; returns the Bearer token. */
async function loginDemo(httpServer: App): Promise<string> {
  const res = await request(httpServer)
    .post('/auth/token')
    .type('form')
    .send({ username: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return z.object({ access_token: z.string() }).parse(res.body).access_token;
}

describe('demo-data seed gating (integration)', () => {
  describe('SEED_DEMO_DATA=true', () => {
    let seeded: TestApp;

    beforeAll(async () => {
      seeded = await createIntegrationApp({ SEED_DEMO_DATA: 'true' });
    });

    afterAll(async () => {
      await seeded.close();
    });

    it('seeds the demo therapist whose credentials log in', async () => {
      const token = await loginDemo(seeded.httpServer);
      const res = await request(seeded.httpServer)
        .get('/auth/whoami')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const whoami = whoamiSchema.parse(res.body);
      expect(whoami).toMatchObject({ email: DEMO_EMAIL, full_name: 'ד״ר רותם שגב' });
    });

    it('exposes the seeded patient roster', async () => {
      const token = await loginDemo(seeded.httpServer);
      const res = await request(seeded.httpServer)
        .get('/patients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const patients = patientListSchema.parse(res.body);
      expect(patients).toHaveLength(SEEDED_PATIENT_COUNT);
      expect(patients.map((p) => p.name)).toEqual(
        expect.arrayContaining(['דנה לוי', 'יוסי מזרחי', 'מיכל כהן', 'אבי פרץ']),
      );
    });

    it('exposes the 8 seeded appointments, therapist-scoped', async () => {
      const token = await loginDemo(seeded.httpServer);
      const res = await request(seeded.httpServer)
        .get('/calendar')
        .query({ from: isoDate(0), to: isoDate(CALENDAR_WINDOW_DAYS), time_zone: 'Asia/Jerusalem' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const events = calendarListSchema.parse(res.body);
      expect(events).toHaveLength(SEEDED_APPOINTMENT_COUNT);
      for (const event of events) {
        expect(event.therapist_id).toBe(DEMO_THERAPIST_ID);
      }
    });
  });
  // The gate (SEED_DEMO_DATA off → nothing seeded) is asserted in db.int-spec,
  // which boots with the flag at its default (false) — avoids a second provisioned
  // app in this file (the factory reuses one database per file).
});
