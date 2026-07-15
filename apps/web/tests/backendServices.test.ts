// Backend service wiring — transcripts / notifications / profile / settings / notes.
// Each service is dormant (throws NO_API) until VITE_API_BASE_URL is set, then calls
// the documented endpoint. Env is read at import time, so we reset modules per case.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://api.test.example';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Imports a service module with VITE_API_BASE_URL set (or empty to stay dormant). */
async function load<T>(path: string, baseUrl: string): Promise<T> {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', baseUrl);
  return (await import(path)) as T;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse({}));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('transcripts service', () => {
  it('throws NO_API when the backend is unset', async () => {
    const svc = await load<typeof import('../src/services/transcripts')>(
      '../src/services/transcripts',
      '',
    );
    await expect(svc.fetchMeetingTranscript('m1')).rejects.toMatchObject({ code: 'NO_API' });
  });

  it('GETs the transcript endpoint and returns segments', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ meeting_id: 'm1', language: 'he', raw_text: 'x', segments: [{ speaker: 'מטפל/ת', text: 'שלום' }] }),
    );
    const svc = await load<typeof import('../src/services/transcripts')>(
      '../src/services/transcripts',
      BASE,
    );
    const result = await svc.fetchMeetingTranscript('m1');
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/meetings/m1/transcript`);
    expect(result.segments[0]).toEqual({ speaker: 'מטפל/ת', text: 'שלום' });
  });
});

describe('notifications service', () => {
  it('lists and patches through the API', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'n1', read: false }]));
    const svc = await load<typeof import('../src/services/notifications')>(
      '../src/services/notifications',
      BASE,
    );
    const list = await svc.listNotifications();
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/notifications`);
    expect(list).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'n1', read: true }));
    await svc.updateNotification('n1', { read: true });
    const patchInit = fetchMock.mock.calls[1][1];
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/notifications/n1`);
    expect(patchInit.method).toBe('PATCH');
    expect(patchInit.body).toBe(JSON.stringify({ read: true }));
  });

  it('is dormant when unset', async () => {
    const svc = await load<typeof import('../src/services/notifications')>(
      '../src/services/notifications',
      '',
    );
    await expect(svc.listNotifications()).rejects.toMatchObject({ code: 'NO_API' });
  });
});

describe('profile service', () => {
  it('GET /auth/me and PATCH /auth/me', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: 'u1', full_name: 'ד״ר רותם שגב' }));
    const svc = await load<typeof import('../src/services/profile')>(
      '../src/services/profile',
      BASE,
    );
    const me = await svc.fetchProfile();
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/auth/me`);
    expect(me.full_name).toBe('ד״ר רותם שגב');

    fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: 'u1', phone: '050-9' }));
    await svc.updateProfile({ phone: '050-9' });
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
  });
});

describe('settings service', () => {
  it('unwraps and rewraps the preferences envelope', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ preferences: { appearance: { theme: 'light' } } }));
    const svc = await load<typeof import('../src/services/settings')>(
      '../src/services/settings',
      BASE,
    );
    const prefs = await svc.fetchSettings();
    expect(prefs).toEqual({ appearance: { theme: 'light' } });

    fetchMock.mockResolvedValueOnce(jsonResponse({ preferences: { appearance: { theme: 'dark' } } }));
    const saved = await svc.saveSettings({ appearance: { theme: 'dark' } });
    const putInit = fetchMock.mock.calls[1][1];
    expect(putInit.method).toBe('PUT');
    expect(putInit.body).toBe(JSON.stringify({ preferences: { appearance: { theme: 'dark' } } }));
    expect(saved).toEqual({ appearance: { theme: 'dark' } });
  });
});

describe('notes service', () => {
  it('GET and PUT the patient note endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ patient_id: 'p1', body: 'הערה', updated_at: null }));
    const svc = await load<typeof import('../src/services/notes')>('../src/services/notes', BASE);
    const note = await svc.fetchPatientNote('p1');
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/patients/p1/notes`);
    expect(note.body).toBe('הערה');

    fetchMock.mockResolvedValueOnce(jsonResponse({ patient_id: 'p1', body: 'חדש', updated_at: null }));
    await svc.savePatientNote('p1', 'חדש');
    const putInit = fetchMock.mock.calls[1][1];
    expect(putInit.method).toBe('PUT');
    expect(putInit.body).toBe(JSON.stringify({ body: 'חדש' }));
  });
});
