// useNotifications — the notification feed comes from the live API when configured
// (mapped to the page's field names), falling back to the demo list otherwise.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

vi.mock('../src/services/apiClient', () => ({ isApiConfigured: vi.fn(() => false) }));
vi.mock('../src/services/notifications', () => ({ listNotifications: vi.fn() }));

import { isApiConfigured } from '../src/services/apiClient';
import { listNotifications } from '../src/services/notifications';
import { useNotifications, type FeedNotification } from '../src/hooks/useNotifications';

const DEMO: FeedNotification[] = [
  { id: 'd1', kind: 'summary', title: 'דמו', text: 'טקסט', time: 'עכשיו', group: 'היום', pid: 'p1', read: false, archived: false },
];

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('useNotifications', () => {
  it('demo mode: returns the demo feed, apiMode false, never fetches', () => {
    (isApiConfigured as any).mockReturnValue(false);
    const { result } = renderHook(() => useNotifications(DEMO));
    expect(result.current.apiMode).toBe(false);
    expect(result.current.notifs).toEqual(DEMO);
    expect(listNotifications).not.toHaveBeenCalled();
  });

  it('API mode: maps the live list onto the page field names', async () => {
    (isApiConfigured as any).mockReturnValue(true);
    (listNotifications as any).mockResolvedValue([
      { id: 'c1', kind: 'risk', patient_id: 'a3', title: 'דגל', body: 'גוף', group_label: 'אתמול', display_time: 'אתמול 09:30', read: true, archived: false },
    ]);
    const { result } = renderHook(() => useNotifications(DEMO));
    await waitFor(() => expect(result.current.notifs[0].id).toBe('c1'));
    expect(result.current.apiMode).toBe(true);
    expect(result.current.notifs[0]).toMatchObject({
      id: 'c1', kind: 'risk', pid: 'a3', title: 'דגל', text: 'גוף', time: 'אתמול 09:30', group: 'אתמול', read: true,
    });
  });

  it('API mode: falls back to the demo feed on error', async () => {
    (isApiConfigured as any).mockReturnValue(true);
    (listNotifications as any).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useNotifications(DEMO));
    await waitFor(() => expect(result.current.notifs).toEqual(DEMO));
  });
});
