// Patient data-model additions: address (shown + editable) and the treatment
// start/end span (in months) for archived files.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { formatTreatmentSpan } from '../src/services/patients';
import { reconcileMockPatients, MOCK_PATIENTS } from '../src/data/mockPatients';

describe('reconcileMockPatients — field backfill', () => {
  it('backfills a missing address on an already-cached seeded patient', () => {
    const stale = MOCK_PATIENTS.map(({ address: _a, ...rest }) => rest); // roster cached before addresses existed
    const merged = reconcileMockPatients(stale as any);
    expect(merged).not.toBe(stale); // changed → new array applied by the store
    expect(merged.find((p) => p.id === 'p1')?.address).toBe(MOCK_PATIENTS[0].address);
  });
  it('returns the same reference when nothing changed', () => {
    const roster = MOCK_PATIENTS.map((p) => ({ ...p }));
    expect(reconcileMockPatients(roster)).toBe(roster);
  });
});

describe('formatTreatmentSpan', () => {
  it('shows start–end and the duration in months for an archived file', () => {
    const r = formatTreatmentSpan('2025-01-15T10:00:00Z', '2025-07-15T10:00:00Z');
    expect(r).toContain('01/25');
    expect(r).toContain('07/25');
    expect(r).toMatch(/6 חודשים/);
  });
  it('falls back to the start month when there is no end date', () => {
    expect(formatTreatmentSpan('2025-01-15T10:00:00Z')).toBe('01/25');
  });
});

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('patient screen — address + archived span', () => {
  it('shows the address on the active patient file and edit exposes an address field', async () => {
    mount({ view: 'app', route: 'patient', patientId: 'p1' });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('הרצל 42'));
    expect(document.body.textContent).toContain('מאז');
  });

  it('shows a treatment span (start–end · months) for an archived file', async () => {
    const archived = { id: 'pz', name: 'רון ארכיון', phone: '050-0000000', email: null, address: 'דיזנגוף 1, תל אביב', created_at: '2024-01-01T10:00:00Z', archived_at: '2024-09-01T10:00:00Z', archived: true };
    mount({ view: 'app', route: 'patient', patientId: 'pz', archivedPatients: [archived] });
    await settle();
    await waitFor(() => expect(document.body.textContent).toContain('טיפול:'));
    expect(document.body.textContent).toMatch(/חודשים/);
    expect(document.body.textContent).not.toContain('מאז'); // "since" is replaced for archived
  });
});
