import { AssistantTools, Fetcher, isSafePath, SAFE_PREFIX } from './tools';

/** A recording fake fetcher — never touches the network. */
function fakeFetcher(response: [number, unknown]): { fetch: Fetcher; calls: string[] } {
  const calls: string[] = [];
  const fetch: Fetcher = (url) => {
    calls.push(url);
    return Promise.resolve(response);
  };
  return { fetch, calls };
}

describe('assistant tools — SSRF guards (isSafePath)', () => {
  it('permits the PHI-safe context namespace by default', () => {
    expect(isSafePath(`${SAFE_PREFIX}patients`, false)).toBe(true);
    expect(isSafePath('/assistant/context/patient/abc/meetings', false)).toBe(true);
  });

  it('refuses anything outside the context namespace unless allowAll', () => {
    expect(isSafePath('/patients', false)).toBe(false);
    expect(isSafePath('/patients', true)).toBe(true);
  });

  it('refuses traversal, protocol-relative, and non-absolute paths', () => {
    expect(isSafePath('/assistant/context/../auth/token', false)).toBe(false);
    expect(isSafePath('/assistant/context//evil', false)).toBe(false);
    expect(isSafePath('assistant/context/patients', false)).toBe(false);
    expect(isSafePath('/ok/../x', true)).toBe(false);
  });
});

describe('assistant tools — discover_api', () => {
  const spec = {
    paths: {
      '/assistant/context/patients': { get: { summary: 'roster', parameters: [] } },
      '/assistant/context/agenda': {
        get: { summary: 'agenda', parameters: [{ name: 'days' }] },
      },
      '/patients': { get: { summary: 'all patients (PHI)' }, post: {} },
    },
  };

  it('returns only context GET endpoints when scoped (default)', async () => {
    const { fetch } = fakeFetcher([200, spec]);
    const tools = new AssistantTools({ baseUrl: 'http://localhost:3000', fetch, allowAllGets: false });
    const result = (await tools.discover()) as { endpoints: Array<{ path: string; params?: string[] }> };
    const paths = result.endpoints.map((e) => e.path);
    expect(paths).toEqual(['/assistant/context/patients', '/assistant/context/agenda']);
    expect(paths).not.toContain('/patients');
    // stripped shape: params surfaced, verbs/responses dropped
    expect(result.endpoints[1].params).toEqual(['days']);
  });

  it('exposes every GET (incl. PHI) when allowAllGets is on', async () => {
    const { fetch } = fakeFetcher([200, spec]);
    const tools = new AssistantTools({ baseUrl: 'http://localhost:3000', fetch, allowAllGets: true });
    const result = (await tools.discover()) as { endpoints: Array<{ path: string }> };
    expect(result.endpoints.map((e) => e.path)).toContain('/patients');
  });

  it('reports an error when the spec cannot be loaded', async () => {
    const { fetch } = fakeFetcher([500, null]);
    const tools = new AssistantTools({ baseUrl: 'http://localhost:3000', fetch, allowAllGets: false });
    expect(await tools.discover()).toEqual({ error: 'could not load the API description' });
  });
});

describe('assistant tools — http_get', () => {
  it('refuses a non-allow-listed path without fetching', async () => {
    const { fetch, calls } = fakeFetcher([200, {}]);
    const tools = new AssistantTools({ baseUrl: 'http://localhost:3000', fetch, allowAllGets: false });
    const result = (await tools.httpGet('/patients', undefined)) as { error?: string };
    expect(result.error).toContain('/patients');
    expect(calls).toHaveLength(0); // guard fires before any request
  });

  it('fetches an allowed path and returns { status, body }', async () => {
    const { fetch, calls } = fakeFetcher([200, [{ id: 'p1', name: 'דנה' }]]);
    const tools = new AssistantTools({ baseUrl: 'http://localhost:3000', fetch, allowAllGets: false });
    const result = await tools.httpGet('/assistant/context/patients', undefined);
    expect(result).toEqual({ status: 200, body: [{ id: 'p1', name: 'דנה' }] });
    expect(calls[0]).toBe('http://localhost:3000/assistant/context/patients');
  });

  it('dispatch routes tool names and rejects unknown tools', async () => {
    const { fetch } = fakeFetcher([200, {}]);
    const tools = new AssistantTools({ baseUrl: 'http://localhost:3000', fetch, allowAllGets: false });
    expect(tools.specs().map((s) => s.function.name)).toEqual(['discover_api', 'http_get']);
    await expect(tools.dispatch('rm_rf', {})).rejects.toThrow();
  });
});
