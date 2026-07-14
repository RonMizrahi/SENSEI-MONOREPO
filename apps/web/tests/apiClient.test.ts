// Canonical API client tests. The client reads VITE_API_BASE_URL at import time,
// so we stub `import.meta.env` before importing, and mock global.fetch (no real
// network). Covers: dormant-when-unconfigured, URL/query building, auth header
// injection, error mapping, and 204 handling.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://api.test.example';

function loadClient(baseUrl: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', baseUrl);
  return import('../src/services/apiClient');
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('apiClient — dormant when unconfigured', () => {
  it('isApiConfigured() is false and requests throw NO_API when base URL is unset', async () => {
    const api = await loadClient('');
    expect(api.isApiConfigured()).toBe(false);
    await expect(api.apiRequest('/patients')).rejects.toMatchObject({ code: 'NO_API' });
  });
});

describe('apiClient — configured', () => {
  let fetchMock: any;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('is active and builds the URL from base + path + query', async () => {
    const api = await loadClient(BASE + '/'); // trailing slash normalized off
    expect(api.isApiConfigured()).toBe(true);
    await api.apiRequest('/patients', { query: { page: 2, search: 'x', skip: undefined } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/patients?page=2&search=x`);
  });

  it('sends Accept, sets Content-Type only with a body, and omits credentials for cross-origin API calls', async () => {
    const api = await loadClient(BASE);
    await api.apiRequest('/patients', { method: 'POST', body: { name: 'x' } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.Accept).toBe('application/json');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.credentials).toBe('omit');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
  });

  it('injects a Bearer token from the provider and never hardcodes one', async () => {
    const api = await loadClient(BASE);
    api.setAuthTokenProvider(() => 'tok-123');
    await api.apiRequest('/auth/me');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
    api.setAuthTokenProvider(() => null);
    await api.apiRequest('/auth/me');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('maps non-2xx to a typed ApiError with status', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'nope' }), { status: 403 }));
    const api = await loadClient(BASE);
    await expect(api.apiRequest('/x')).rejects.toMatchObject({ status: 403, code: 'HTTP_403' });
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = await loadClient(BASE);
    await expect(api.apiRequest('/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
