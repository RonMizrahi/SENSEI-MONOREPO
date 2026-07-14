import { SEED_MOCK_MODEL } from '../mock/seed';
import { MockReportGenerator } from './mock-report.generator';

describe('MockReportGenerator', () => {
  const generator = new MockReportGenerator();

  it('returns a canned Hebrew report tagged with the mock model', async () => {
    const report = await generator.generate();
    expect(report.model).toBe(SEED_MOCK_MODEL);
    expect(report.intro.length).toBeGreaterThan(0);
    expect(report.changes.length).toBeGreaterThanOrEqual(3);
    expect(report.openTopics.length).toBeGreaterThanOrEqual(3);
  });

  it('returns fresh arrays on every call (no shared mutable state)', async () => {
    const first = await generator.generate();
    first.changes.push('mutation');
    const second = await generator.generate();
    expect(second.changes).not.toContain('mutation');
  });
});
