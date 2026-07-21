// apiAuth — demo bootstrap (register → token), token storage, provider wiring,
// and best-effort server-side logout, against the senseiapi auth contract.
import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://api.test.example';

function loadApiAuth() {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', BASE);
  return import('../src/services/apiAuth');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
  sessionStorage.clear();
});

describe('ensureDemoApiAuth', () => {
  it('anonymous /patients probe ok → true without minting a token', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { ensureDemoApiAuth, getApiAccessToken } = await loadApiAuth();
    await expect(ensureDemoApiAuth()).resolves.toBe(true);
    expect(getApiAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('secured API → register (409 tolerated) then form-encoded /auth/token, token persisted', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const p = String(url);
      if (p.endsWith('/patients')) return new Response('{"detail":"Not authenticated"}', { status: 401 });
      if (p.endsWith('/auth/register')) return new Response('{"detail":"user already exists"}', { status: 409 });
      if (p.endsWith('/auth/token')) {
        // Contract: OAuth2 password flow — urlencoded username/password.
        expect(init?.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
        const body = String(init?.body);
        expect(body).toContain('username=');
        expect(body).toContain('password=');
        return new Response(JSON.stringify({ access_token: 'tok-123', token_type: 'bearer' }), { status: 200 });
      }
      throw new Error('unexpected ' + p);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { ensureDemoApiAuth, getApiAccessToken } = await loadApiAuth();
    await expect(ensureDemoApiAuth()).resolves.toBe(true);
    expect(getApiAccessToken()).toBe('tok-123');
    expect(localStorage.getItem('sensei_api_access_token_v1')).toBe('tok-123'); // remember: true
  });

  it('token endpoint failure → false, no token stored', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const p = String(url);
      if (p.endsWith('/patients')) return new Response('', { status: 401 });
      if (p.endsWith('/auth/register')) return new Response('', { status: 201 });
      return new Response('', { status: 401 }); // /auth/token rejects
    }));
    const { ensureDemoApiAuth, getApiAccessToken } = await loadApiAuth();
    await expect(ensureDemoApiAuth()).resolves.toBe(false);
    expect(getApiAccessToken()).toBeNull();
  });
});

describe('apiLogoutBestEffort', () => {
  it('with a stored token → POST /auth/logout with the Bearer header', async () => {
    localStorage.setItem('sensei_api_access_token_v1', 'tok-9');
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiLogoutBestEffort } = await loadApiAuth();
    apiLogoutBestEffort();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(BASE + '/auth/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-9');
  });

  it('without a token → no request at all', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { apiLogoutBestEffort } = await loadApiAuth();
    apiLogoutBestEffort();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('network failure is swallowed (local sign-out must never block)', async () => {
    localStorage.setItem('sensei_api_access_token_v1', 'tok-9');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { apiLogoutBestEffort } = await loadApiAuth();
    expect(() => apiLogoutBestEffort()).not.toThrow();
  });
});

describe('clearApiAccessToken', () => {
  it('clears both storage scopes', async () => {
    localStorage.setItem('sensei_api_access_token_v1', 'a');
    sessionStorage.setItem('sensei_api_access_token_v1', 'b');
    const { clearApiAccessToken, getApiAccessToken } = await loadApiAuth();
    clearApiAccessToken();
    expect(getApiAccessToken()).toBeNull();
  });
});
