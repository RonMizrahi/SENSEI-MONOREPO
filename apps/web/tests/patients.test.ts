// Patient service — POST/GET/PATCH/DELETE /patients matches senseiapi.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://api.test.example';
const PID = '22222222-2222-2222-2222-222222222222';

function loadPatients() {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', BASE);
  return import('../src/services/patients');
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('patients service — CRUD', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/patients') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          id: PID,
          name: body.name,
          phone: body.phone,
          email: body.email ?? null,
          created_at: '2026-06-17T12:00:00Z',
        }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (path.includes('/patients') && (!init?.method || init.method === 'GET') && !path.includes('/patients/')) {
        const urlObj = new URL(path.startsWith('http') ? path : BASE + (path.startsWith('/') ? path : '/' + path));
        const archived = urlObj.searchParams.get('archived') === 'true';
        const row = {
          id: PID, name: 'Jane Doe', phone: '050-1234567', email: null,
          created_at: '2026-06-17T12:00:00Z', archived: false,
        };
        return new Response(JSON.stringify(archived ? [] : [row]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (path.includes('/patients/') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          id: PID,
          name: body.name ?? 'Jane Doe',
          phone: body.phone ?? '050-1234567',
          email: body.email ?? null,
          created_at: '2026-06-17T12:00:00Z',
          archived: body.archived ?? false,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (path.includes('/patients/') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('POSTs name + phone and omits empty email', async () => {
    const { createPatient } = await loadPatients();
    await createPatient({ name: 'Jane Doe', phone: '050-1234567', email: '' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Jane Doe', phone: '050-1234567' });
  });

  it('GET /patients lists patients', async () => {
    const { listPatients } = await loadPatients();
    const pts = await listPatients();
    expect(pts).toHaveLength(1);
    expect(pts[0].id).toBe(PID);
  });

  it('PATCH /patients/{id} updates fields', async () => {
    const { updatePatient } = await loadPatients();
    const p = await updatePatient(PID, { name: 'New Name', phone: '050-9999999' });
    expect(p.name).toBe('New Name');
    expect(p.phone).toBe('050-9999999');
  });

  it('PATCH /patients/{id} archives patient', async () => {
    const { archivePatient } = await loadPatients();
    const p = await archivePatient(PID);
    expect(p.archived).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ archived: true });
  });

  it('GET /patients?archived=true lists archived patients', async () => {
    const { listArchivedPatients } = await loadPatients();
    await listArchivedPatients();
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain('/patients?archived=true');
  });

  it('DELETE /patients/{id} returns 204', async () => {
    const { deletePatient } = await loadPatients();
    await expect(deletePatient(PID)).resolves.toBeUndefined();
  });

  it('loadPatientsWithFallback returns mock roster when API is unset', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { loadPatientsWithFallback } = await import('../src/services/patients');
    const mock = [{ id: 'p1', name: 'Test', phone: '050', email: null, created_at: '2026-01-01T00:00:00Z' }];
    const { patients, source } = await loadPatientsWithFallback(mock);
    expect(source).toBe('mock');
    expect(patients).toEqual(mock);
  });

  it('loadPatientsWithFallback returns empty roster when API fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { loadPatientsWithFallback } = await loadPatients();
    const mock = [{ id: 'p1', name: 'Test', phone: '050', email: null, created_at: '2026-01-01T00:00:00Z' }];
    const { patients, source } = await loadPatientsWithFallback(mock);
    expect(source).toBe('api');
    expect(patients).toEqual([]);
  });
});

describe('patient UI helpers', () => {
  it('derives initials, color, since and email display', async () => {
    const {
      patientInitials, patientAvatarColor, formatPatientSince, displayPatientEmail,
    } = await loadPatients();
    expect(patientInitials('דנה לוי')).toBe('דל');
    expect(patientAvatarColor('p1')).toMatch(/^#/);
    expect(formatPatientSince('2026-06-17T12:00:00Z')).toBe('06.2026');
    expect(displayPatientEmail(null)).toBe('—');
    expect(displayPatientEmail('a@b.com')).toBe('a@b.com');
  });
});
