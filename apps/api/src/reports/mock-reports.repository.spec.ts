import { randomUUID } from 'node:crypto';
import { SEED_EVENTS, SEED_PATIENTS, SEED_SUMMARY_TEXT, SEED_USER } from '../mock/seed';
import { MockReportsRepository } from './mock-reports.repository';

const SEEDED_PATIENT_ID = SEED_PATIENTS[0].id;

describe('MockReportsRepository', () => {
  let repository: MockReportsRepository;

  beforeEach(() => {
    repository = new MockReportsRepository();
  });

  it('recognizes seeded patients and rejects unknown ids', async () => {
    await expect(repository.patientExists(SEEDED_PATIENT_ID)).resolves.toBe(true);
    await expect(repository.patientExists(randomUUID())).resolves.toBe(false);
  });

  it('therapistHasMeetingWithPatient is true only for SEED_USER with a seeded meeting', async () => {
    await expect(
      repository.therapistHasMeetingWithPatient(SEEDED_PATIENT_ID, SEED_USER.id),
    ).resolves.toBe(true);
    // right patient, wrong therapist → not owned
    await expect(
      repository.therapistHasMeetingWithPatient(SEEDED_PATIENT_ID, randomUUID()),
    ).resolves.toBe(false);
    // right therapist, patient with no seeded meetings → false
    await expect(
      repository.therapistHasMeetingWithPatient(randomUUID(), SEED_USER.id),
    ).resolves.toBe(false);
  });

  it('returns null before any report was requested', async () => {
    await expect(repository.findByPatientId(SEEDED_PATIENT_ID)).resolves.toBeNull();
  });

  it('resetToPending creates a clean pending row and wipes previous content', async () => {
    const first = await repository.resetToPending(SEEDED_PATIENT_ID);
    expect(first.status).toBe('pending');
    await repository.markReady(SEEDED_PATIENT_ID, {
      intro: 'מבוא',
      changes: ['שינוי'],
      openTopics: ['נושא'],
      sourceMeetingIds: ['m1'],
      lastSummaryExcerpt: 'תקציר',
      generatedAt: new Date(),
      model: 'mock',
    });
    const reset = await repository.resetToPending(SEEDED_PATIENT_ID);
    expect(reset.status).toBe('pending');
    expect(reset.intro).toBeNull();
    expect(reset.changes).toEqual([]);
    expect(reset.id).toBe(first.id);
  });

  it('walks the lifecycle running → ready with the generated fields', async () => {
    await repository.resetToPending(SEEDED_PATIENT_ID);
    await repository.markRunning(SEEDED_PATIENT_ID);
    let row = await repository.findByPatientId(SEEDED_PATIENT_ID);
    expect(row?.status).toBe('running');
    const generatedAt = new Date();
    await repository.markReady(SEEDED_PATIENT_ID, {
      intro: 'מבוא',
      changes: ['שינוי'],
      openTopics: ['נושא'],
      sourceMeetingIds: ['m1'],
      lastSummaryExcerpt: 'תקציר',
      generatedAt,
      model: 'mock',
    });
    row = await repository.findByPatientId(SEEDED_PATIENT_ID);
    expect(row).toMatchObject({ status: 'ready', intro: 'מבוא', generatedAt, error: null });
  });

  it('markFailed records the error', async () => {
    await repository.resetToPending(SEEDED_PATIENT_ID);
    await repository.markFailed(SEEDED_PATIENT_ID, 'נכשל');
    const row = await repository.findByPatientId(SEEDED_PATIENT_ID);
    expect(row).toMatchObject({ status: 'failed', error: 'נכשל' });
  });

  it('serves the seeded meetings as ready summaries in chronological order', async () => {
    const summaries = await repository.findReadySummaries(SEEDED_PATIENT_ID, SEED_USER.id);
    const expected = SEED_EVENTS.filter((event) => event.patientId === SEEDED_PATIENT_ID);
    expect(summaries).toHaveLength(expected.length);
    expect(summaries[0].text).toBe(SEED_SUMMARY_TEXT);
    const offsets = summaries.map(
      (summary) => SEED_EVENTS.find((event) => event.id === summary.meetingId)?.dayOffset,
    );
    expect(offsets).toEqual([...offsets].sort((a, b) => (a ?? 0) - (b ?? 0)));
  });

  it('returns no summaries for another therapist even with a valid patient', async () => {
    await expect(
      repository.findReadySummaries(SEEDED_PATIENT_ID, randomUUID()),
    ).resolves.toEqual([]);
  });

  it('returns no summaries for a patient without seeded meetings', async () => {
    await expect(repository.findReadySummaries(randomUUID(), SEED_USER.id)).resolves.toEqual([]);
  });

  it('sweeps only rows stranded in running', async () => {
    await repository.resetToPending(SEED_PATIENTS[0].id);
    await repository.markRunning(SEED_PATIENTS[0].id);
    await repository.resetToPending(SEED_PATIENTS[1].id);
    const swept = await repository.failStrandedRunning('interrupted');
    expect(swept).toBe(1);
    const stranded = await repository.findByPatientId(SEED_PATIENTS[0].id);
    expect(stranded).toMatchObject({ status: 'failed', error: 'interrupted' });
    const untouched = await repository.findByPatientId(SEED_PATIENTS[1].id);
    expect(untouched?.status).toBe('pending');
  });
});
