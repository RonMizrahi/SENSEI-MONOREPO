// React Query patients list — enabled only when VITE_API_BASE_URL is set.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../src/query/queryClient';

const BASE = 'https://api.test.example';
const PID = '22222222-2222-2222-2222-222222222222';

function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createTestQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_API_BASE_URL', '');
});

describe('usePatientsQuery', () => {
  it('does not fetch when the API is not configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { usePatientsQuery } = await import('../src/query/usePatientsQuery');
    function Probe() {
      const q = usePatientsQuery();
      return <span data-testid="fetching">{String(q.isFetching)}</span>;
    }
    const { getByTestId } = render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(getByTestId('fetching').textContent).toBe('false'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches listPatients when the API is configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', BASE);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/patients')) {
        return new Response(JSON.stringify([
          {
            id: PID,
            name: 'Jane Doe',
            phone: '050-1234567',
            email: null,
            created_at: '2026-06-17T12:00:00Z',
          },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    }));
    const { usePatientsQuery } = await import('../src/query/usePatientsQuery');
    function Probe() {
      const q = usePatientsQuery();
      return (
        <div>
          <span data-testid="count">{q.data?.length ?? -1}</span>
          <span data-testid="name">{q.data?.[0]?.name ?? ''}</span>
        </div>
      );
    }
    const { getByTestId } = render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(getByTestId('count').textContent).toBe('1'));
    expect(getByTestId('name').textContent).toBe('Jane Doe');
  });
});
