import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildMockScheduledAppts, MOCK_PATIENTS } from '../src/data/mockPatients';
import { localApptsToUiEvents } from '../src/services/calendar';

afterEach(() => { vi.unstubAllEnvs(); });

describe('offline mock roster', () => {
  it('includes 4 demo patients', () => {
    expect(MOCK_PATIENTS).toHaveLength(4);
    expect(MOCK_PATIENTS.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('builds upcoming meetings for each demo patient', () => {
    const appts = buildMockScheduledAppts(new Date('2026-06-17T10:00:00Z'));
    expect(appts.length).toBeGreaterThanOrEqual(4);
    for (const patient of MOCK_PATIENTS) {
      const upcoming = localApptsToUiEvents(appts, patient.id, patient.name, new Date('2026-06-17T10:00:00Z'));
      expect(upcoming.length).toBeGreaterThan(0);
    }
  });
});

describe('loadPatientsWithFallback — mock only without API URL', () => {
  it('uses the mock roster when VITE_API_BASE_URL is unset', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { loadPatientsWithFallback } = await import('../src/services/patients');
    const { patients, source } = await loadPatientsWithFallback([]);
    expect(source).toBe('mock');
    expect(patients).toHaveLength(4);
    expect(patients[0].name).toBe('דנה לוי');
  });
});
