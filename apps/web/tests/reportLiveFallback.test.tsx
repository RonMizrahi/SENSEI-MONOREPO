// Report page resilience — a failed/unavailable live report (e.g. the Ollama model is
// missing on the backend) must NOT block the page: it falls back to the demo prep body
// with a subtle notice, never a full error wall.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { MOCK_PATIENTS } from '../src/data/mockPatients';
import type { CalendarUiEvent } from '../src/services/calendar';

const { isApiConfiguredMock, loadPatientUpcomingEvents, loadPatientsWithFallback, listPatientsMock, pollMock, regenMock } = vi.hoisted(() => ({
  isApiConfiguredMock: vi.fn(() => true),
  loadPatientUpcomingEvents: vi.fn(async () => [] as CalendarUiEvent[]),
  loadPatientsWithFallback: vi.fn(async (current: Array<{ id: string; name: string }>) => ({ patients: current })),
  listPatientsMock: vi.fn(),
  pollMock: vi.fn(),
  regenMock: vi.fn(),
}));

vi.mock('../src/services/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/apiClient')>();
  return { ...actual, isApiConfigured: isApiConfiguredMock };
});
vi.mock('../src/services/calendar', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/calendar')>();
  return { ...actual, loadPatientUpcomingEvents };
});
vi.mock('../src/services/patients', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/patients')>();
  // In API mode the roster comes from the live patients query (listPatients), which the
  // PatientsQueryBridge mirrors into the store — feed it so the current patient resolves.
  return { ...actual, loadPatientsWithFallback, listPatients: listPatientsMock };
});
vi.mock('../src/services/nextMeetingReport', async (importActual) => {
  const actual = await importActual<typeof import('../src/services/nextMeetingReport')>();
  return { ...actual, pollNextMeetingReport: pollMock, regenerateNextMeetingReport: regenMock };
});

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
beforeEach(() => {
  isApiConfiguredMock.mockReturnValue(true);
  loadPatientUpcomingEvents.mockResolvedValue([]);
  loadPatientsWithFallback.mockImplementation(async () => ({ patients: MOCK_PATIENTS }));
  listPatientsMock.mockResolvedValue(MOCK_PATIENTS);
});

describe('report page — live generation failure never blocks the UI', () => {
  it('falls back to the demo prep body (not an error wall) when generation fails', async () => {
    pollMock.mockResolvedValue({
      status: 'failed',
      error: 'model "qwen2.5:7b-instruct" not found',
      meeting_id: 'm1',
      intro: null,
      changes: [],
      open_topics: [],
      generated_at: null,
      last_summary_excerpt: null,
    });

    mount({ view: 'app', route: 'report', patientId: 'p1', patients: MOCK_PATIENTS });
    await settle();

    await waitFor(() => {
      const main = document.querySelector('#main-content');
      // The prep body still renders...
      expect(main?.textContent).toContain('כרטיס מטופל');
      expect(main?.textContent).toContain('שם המטופל');
      // ...with a subtle fallback notice...
      expect(main?.textContent).toContain('מוצג דוח הדגמה');
      // ...and NOT the old blocking error screen or the raw backend error.
      expect(main?.textContent).not.toContain('לא ניתן להציג את הדוח');
      expect(main?.textContent).not.toContain('qwen2.5:7b-instruct');
    });
  });
});
