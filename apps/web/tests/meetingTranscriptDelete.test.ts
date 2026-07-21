import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_API_BASE_URL', '');
});

describe('deleteMeetingTranscript', () => {
  it('DELETEs /meetings/{id}/transcript and treats 404 as already clear', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.example');
    vi.resetModules();
    const fetchMock = vi.fn(async (_url?: unknown, _init?: unknown) => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { deleteMeetingTranscript } = await import('../src/services/meetingTranscript');
    await deleteMeetingTranscript('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain('/meetings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/transcript');
    expect(init.method).toBe('DELETE');

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'gone' }), { status: 404 }));
    await expect(deleteMeetingTranscript('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).resolves.toBeUndefined();
  });
});
