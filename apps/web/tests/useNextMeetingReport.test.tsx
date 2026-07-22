// useNextMeetingReport — resolves the prep-report content shared by the desktop
// ReportPage and the mobile prep report: the live senseiapi report when
// configured, the shared demo copy otherwise. The API layer is mocked.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

vi.mock('../src/services/apiClient', () => ({ isApiConfigured: vi.fn(() => false) }));
vi.mock('../src/services/nextMeetingReport', () => ({ pollNextMeetingReport: vi.fn() }));

import { isApiConfigured } from '../src/services/apiClient';
import { pollNextMeetingReport } from '../src/services/nextMeetingReport';
import { useNextMeetingReport } from '../src/hooks/useNextMeetingReport';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('useNextMeetingReport', () => {
  it('demo mode: returns the shared demo copy, not loading, not live', () => {
    (isApiConfigured as any).mockReturnValue(false);
    const { result } = renderHook(() => useNextMeetingReport('p1', 'דנה לוי', 'DEMO SUMMARY', 'DEMO INSIGHT'));
    expect(result.current.live).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('');
    expect(result.current.summary).toBe('DEMO SUMMARY');
    expect(result.current.insight).toBe('DEMO INSIGHT');
    expect(result.current.changes.length).toBeGreaterThan(0);
    expect(result.current.openTopics.length).toBeGreaterThan(0);
    expect(result.current.questions.length).toBeGreaterThan(0); // demo suggested questions shown
    expect(result.current.intro).toContain('דנה לוי');
    expect(pollNextMeetingReport).not.toHaveBeenCalled();
  });

  it('API mode: surfaces the live report when ready', async () => {
    (isApiConfigured as any).mockReturnValue(true);
    (pollNextMeetingReport as any).mockResolvedValue({
      patient_id: 'p1', status: 'ready',
      intro: 'LIVE INTRO', changes: ['live change'], open_topics: ['live topic'],
      last_summary_excerpt: 'LIVE EXCERPT',
    });
    const { result } = renderHook(() => useNextMeetingReport('p1', 'דנה לוי', 'DEMO SUMMARY', 'DEMO INSIGHT'));
    await waitFor(() => expect(result.current.live).toBe(true));
    expect(result.current.intro).toBe('LIVE INTRO');
    expect(result.current.changes).toEqual(['live change']);
    expect(result.current.openTopics).toEqual(['live topic']);
    expect(result.current.summary).toBe('LIVE EXCERPT');
    expect(result.current.insight).toBe('LIVE EXCERPT');
    expect(result.current.questions).toEqual([]); // hidden once a live report is ready
    expect(result.current.loading).toBe(false);
    expect(pollNextMeetingReport).toHaveBeenCalledWith('p1', expect.any(Object));
  });

  it('API mode: surfaces a failed-report error and falls back to demo copy', async () => {
    (isApiConfigured as any).mockReturnValue(true);
    (pollNextMeetingReport as any).mockResolvedValue({ patient_id: 'p1', status: 'failed', error: 'boom' });
    const { result } = renderHook(() => useNextMeetingReport('p1', 'דנה לוי', 'DEMO SUMMARY', 'DEMO INSIGHT'));
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.live).toBe(false);
    expect(result.current.summary).toBe('DEMO SUMMARY');
  });
});
