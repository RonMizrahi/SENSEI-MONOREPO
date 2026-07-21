// Simba mock prep report — offline demo content.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { getMockMeetingReport } from '../src/data/mockMeetingReports';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('simba mock prep report', () => {
  it('exposes Lion King themed content for patient p5', () => {
    const report = getMockMeetingReport('p5');
    expect(report).toBeTruthy();
    expect(report?.intro).toContain('האקונה מטאטה');
    expect(report?.nextMeetingDate).toBe('2026-07-21');
    expect(report?.suggested_questions).toHaveLength(2);
  });

  it('renders custom sections on the report page', async () => {
    mount({ view: 'app', route: 'report', patientId: 'p5' });
    await settle();
    await waitFor(() => {
      const main = document.querySelector('#main-content');
      expect(main?.textContent).toContain('כרטיס מטופל');
      expect(main?.textContent).toContain('שם המטופל');
      expect(main?.textContent).toContain('סימבה');
      expect(main?.textContent).toContain('21/07/26');
      expect(main?.textContent).toContain('054-9876543');
      expect(main?.textContent).toContain('סיכום הפגישה הקודמת');
      expect(main?.textContent).toContain('מטרות לפגישה הקרובה');
      expect(main?.textContent).toContain('נקודות למעקב');
      expect(main?.textContent).toContain('שאלות מוצעות למפגש');
      expect(main?.textContent).toContain('האקונה מטאטה');
    });
  });
});
