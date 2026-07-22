import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildMockScheduledAppts, MOCK_PATIENTS, reconcileMockAppts, reconcileMockPatients } from '../src/data/mockPatients';
import { localApptsToUiEvents } from '../src/services/calendar';

afterEach(() => { vi.unstubAllEnvs(); });

describe('offline mock roster', () => {
  it('includes 5 demo patients', () => {
    expect(MOCK_PATIENTS).toHaveLength(5);
    expect(MOCK_PATIENTS.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(MOCK_PATIENTS.find((p) => p.id === 'p5')?.name).toBe('סימבה');
  });

  it('builds upcoming meetings for each demo patient', () => {
    const appts = buildMockScheduledAppts(new Date('2026-06-17T10:00:00Z'));
    expect(appts.length).toBeGreaterThanOrEqual(5);
    for (const patient of MOCK_PATIENTS) {
      const upcoming = localApptsToUiEvents(appts, patient.id, patient.name, new Date('2026-06-17T10:00:00Z'));
      expect(upcoming.length).toBeGreaterThan(0);
    }
  });

  it('merges new demo patients into a cached offline roster', () => {
    const cached = MOCK_PATIENTS.slice(0, 4);
    const merged = reconcileMockPatients(cached);
    expect(merged).toHaveLength(5);
    expect(merged.find((p) => p.id === 'p5')?.name).toBe('סימבה');
  });

  it('merges new demo appointments into a cached offline schedule', () => {
    const cached = buildMockScheduledAppts().slice(0, 8);
    const merged = reconcileMockAppts(cached);
    expect(merged.length).toBeGreaterThan(cached.length);
    expect(merged.some((a) => a.pid === 'p5')).toBe(true);
  });
});

describe('loadPatientsWithFallback — mock only without API URL', () => {
  it('uses the mock roster when VITE_API_BASE_URL is unset', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { loadPatientsWithFallback } = await import('../src/services/patients');
    const { patients, source } = await loadPatientsWithFallback([]);
    expect(source).toBe('mock');
    expect(patients).toHaveLength(5);
    expect(patients[0].name).toBe('דנה לוי');
  });
});
