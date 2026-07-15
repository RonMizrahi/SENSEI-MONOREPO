import { SEED_EVENTS, SEED_MOCK_MODEL, SEED_SUMMARY_TEXT, SEED_USER } from '../mock/seed';
import { SummariesMockRepository } from './summaries.repository';

describe('SummariesMockRepository', () => {
  let repository: SummariesMockRepository;

  beforeEach(() => {
    repository = new SummariesMockRepository();
  });

  it('pre-seeds a ready summary for the first seeded meeting', async () => {
    const row = await repository.findByMeetingId(SEED_EVENTS[0].id);

    expect(row).not.toBeNull();
    expect(row?.status).toBe('ready');
    expect(row?.text).toBe(SEED_SUMMARY_TEXT);
    expect(row?.model).toBe(SEED_MOCK_MODEL);
  });

  it('returns null for a meeting without a summary', async () => {
    await expect(repository.findByMeetingId(crypto.randomUUID())).resolves.toBeNull();
  });

  it('createPending creates a fresh pending row', async () => {
    const meetingId = crypto.randomUUID();

    await repository.createPending(meetingId);

    const row = await repository.findByMeetingId(meetingId);
    expect(row?.meetingId).toBe(meetingId);
    expect(row?.status).toBe('pending');
    expect(row?.text).toBeNull();
    expect(row?.error).toBeNull();
  });

  it('re-enqueue resets an existing row to pending and clears text/error', async () => {
    const meetingId = crypto.randomUUID();
    await repository.createPending(meetingId);
    await repository.markReady(meetingId, 'טקסט', 'm1');

    await repository.createPending(meetingId);

    const reset = await repository.findByMeetingId(meetingId);
    expect(reset?.status).toBe('pending');
    expect(reset?.text).toBeNull();
    expect(reset?.error).toBeNull();
  });

  it('walks the pending → running → ready lifecycle', async () => {
    const meetingId = crypto.randomUUID();
    await repository.createPending(meetingId);

    await repository.markRunning(meetingId);
    expect((await repository.findByMeetingId(meetingId))?.status).toBe('running');

    await repository.markReady(meetingId, 'סיכום', 'm1');
    const ready = await repository.findByMeetingId(meetingId);
    expect(ready?.status).toBe('ready');
    expect(ready?.text).toBe('סיכום');
    expect(ready?.model).toBe('m1');
    expect(ready?.error).toBeNull();
  });

  it('markFailed records the error on the row', async () => {
    const meetingId = crypto.randomUUID();
    await repository.createPending(meetingId);

    await repository.markFailed(meetingId, 'boom');

    const failed = await repository.findByMeetingId(meetingId);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('boom');
  });

  it('failAllRunning sweeps only running rows and reports the count', async () => {
    const runningId = crypto.randomUUID();
    const pendingId = crypto.randomUUID();
    await repository.createPending(runningId);
    await repository.markRunning(runningId);
    await repository.createPending(pendingId);

    const swept = await repository.failAllRunning('interrupted');

    expect(swept).toBe(1);
    expect((await repository.findByMeetingId(runningId))?.status).toBe('failed');
    expect((await repository.findByMeetingId(runningId))?.error).toBe('interrupted');
    expect((await repository.findByMeetingId(pendingId))?.status).toBe('pending');
  });

  it('meetingBelongsToTherapist is true only for a seeded meeting owned by SEED_USER', async () => {
    await expect(
      repository.meetingBelongsToTherapist(SEED_EVENTS[1].id, SEED_USER.id),
    ).resolves.toBe(true);
    // right meeting, wrong therapist → not owned
    await expect(
      repository.meetingBelongsToTherapist(SEED_EVENTS[1].id, crypto.randomUUID()),
    ).resolves.toBe(false);
    // unknown meeting, right therapist → absent
    await expect(
      repository.meetingBelongsToTherapist(crypto.randomUUID(), SEED_USER.id),
    ).resolves.toBe(false);
  });

  it('returned rows are copies — mutating them does not corrupt the store', async () => {
    const row = await repository.findByMeetingId(SEED_EVENTS[0].id);
    if (row) row.status = 'failed';

    expect((await repository.findByMeetingId(SEED_EVENTS[0].id))?.status).toBe('ready');
  });
});
