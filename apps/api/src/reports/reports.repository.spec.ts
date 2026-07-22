import { randomUUID } from 'node:crypto';
import { IsNull, Not, type DataSource } from 'typeorm';
import { PatientReport } from './entities/patient-report.entity';
import { TypeormReportsRepository } from './reports.repository';

interface RepoMock {
  existsBy: jest.Mock;
  exists: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface QueryBuilderMock {
  innerJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  getMany: jest.Mock;
}

function makeQueryBuilder(): QueryBuilderMock {
  const builder: Partial<QueryBuilderMock> = {};
  builder.innerJoin = jest.fn().mockReturnValue(builder);
  builder.where = jest.fn().mockReturnValue(builder);
  builder.andWhere = jest.fn().mockReturnValue(builder);
  builder.orderBy = jest.fn().mockReturnValue(builder);
  builder.getMany = jest.fn();
  return builder as QueryBuilderMock;
}

describe('TypeormReportsRepository', () => {
  let repoMock: RepoMock;
  let queryBuilder: QueryBuilderMock;
  let repository: TypeormReportsRepository;

  beforeEach(() => {
    queryBuilder = makeQueryBuilder();
    repoMock = {
      existsBy: jest.fn(),
      exists: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = { getRepository: jest.fn().mockReturnValue(repoMock) };
    repository = new TypeormReportsRepository(dataSource as unknown as DataSource);
  });

  it('patientExists delegates to existsBy on the Patient entity', async () => {
    const patientId = randomUUID();
    repoMock.existsBy.mockResolvedValue(true);
    await expect(repository.patientExists(patientId)).resolves.toBe(true);
    expect(repoMock.existsBy).toHaveBeenCalledWith({ id: patientId });
  });

  it('therapistHasMeetingWithPatient scopes the existence check by patient AND therapist', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    repoMock.exists.mockResolvedValue(true);
    await expect(
      repository.therapistHasMeetingWithPatient(patientId, therapistId),
    ).resolves.toBe(true);
    expect(repoMock.exists).toHaveBeenCalledWith({ where: { patientId, therapistId } });
  });

  it('findByPatientAndTherapist queries the next-meeting row (meeting_id IS NULL)', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    repoMock.findOne.mockResolvedValue(null);
    await expect(
      repository.findByPatientAndTherapist(patientId, therapistId),
    ).resolves.toBeNull();
    expect(repoMock.findOne).toHaveBeenCalledWith({
      where: { patientId, therapistId, meetingId: IsNull() },
    });
  });

  it('resetToPending upserts a clean pending next-meeting row via the partial index and returns it', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    const row = Object.assign(new PatientReport(), { id: randomUUID(), patientId, therapistId });
    repoMock.findOne.mockResolvedValue(row);
    const saved = await repository.resetToPending(patientId, therapistId);
    expect(repoMock.upsert).toHaveBeenCalledWith(
      {
        patientId,
        therapistId,
        meetingId: null,
        status: 'pending',
        intro: null,
        changes: [],
        openTopics: [],
        sourceMeetingIds: [],
        lastSummaryExcerpt: null,
        generatedAt: null,
        model: '',
        error: null,
      },
      { conflictPaths: ['patientId', 'therapistId'], indexPredicate: 'meeting_id IS NULL' },
    );
    expect(repoMock.findOne).toHaveBeenCalledWith({
      where: { patientId, therapistId, meetingId: IsNull() },
    });
    expect(saved).toBe(row);
  });

  it('resetToPending throws when the upserted row cannot be read back', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(repository.resetToPending(randomUUID(), randomUUID())).rejects.toThrow(
      'did not persist',
    );
  });

  it('mark transitions issue targeted updates scoped to the next-meeting row', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    await repository.markRunning(patientId, therapistId);
    expect(repoMock.update).toHaveBeenCalledWith(
      { patientId, therapistId, meetingId: IsNull() },
      { status: 'running' },
    );

    await repository.markFailed(patientId, therapistId, 'נכשל');
    expect(repoMock.update).toHaveBeenCalledWith(
      { patientId, therapistId, meetingId: IsNull() },
      { status: 'failed', error: 'נכשל' },
    );

    const generatedAt = new Date();
    await repository.markReady(patientId, therapistId, {
      intro: 'מבוא',
      changes: ['שינוי'],
      openTopics: ['נושא'],
      sourceMeetingIds: ['m1'],
      lastSummaryExcerpt: 'תקציר',
      generatedAt,
      model: 'claude-test',
    });
    expect(repoMock.update).toHaveBeenCalledWith(
      { patientId, therapistId, meetingId: IsNull() },
      expect.objectContaining({ status: 'ready', intro: 'מבוא', generatedAt, error: null }),
    );
  });

  it('meetingBelongsToPatientAndTherapist scopes existence by meeting, patient AND therapist', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    const meetingId = randomUUID();
    repoMock.exists.mockResolvedValue(true);
    await expect(
      repository.meetingBelongsToPatientAndTherapist(patientId, therapistId, meetingId),
    ).resolves.toBe(true);
    expect(repoMock.exists).toHaveBeenCalledWith({
      where: { id: meetingId, patientId, therapistId },
    });
  });

  it('listMeetingReports finds the per-meeting rows (meeting_id IS NOT NULL) newest first', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    repoMock.find.mockResolvedValue([]);
    await expect(repository.listMeetingReports(patientId, therapistId)).resolves.toEqual([]);
    expect(repoMock.find).toHaveBeenCalledWith({
      where: { patientId, therapistId, meetingId: Not(IsNull()) },
      order: { updatedAt: 'DESC' },
    });
  });

  it('findByMeeting queries by the exact (patient, therapist, meeting) triple', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    const meetingId = randomUUID();
    repoMock.findOne.mockResolvedValue(null);
    await expect(repository.findByMeeting(patientId, therapistId, meetingId)).resolves.toBeNull();
    expect(repoMock.findOne).toHaveBeenCalledWith({
      where: { patientId, therapistId, meetingId },
    });
  });

  it('resetMeetingToPending upserts via the per-meeting partial index and returns the row', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    const meetingId = randomUUID();
    const row = Object.assign(new PatientReport(), { id: randomUUID(), patientId, therapistId, meetingId });
    repoMock.findOne.mockResolvedValue(row);
    const saved = await repository.resetMeetingToPending(patientId, therapistId, meetingId);
    expect(repoMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ patientId, therapistId, meetingId, status: 'pending' }),
      {
        conflictPaths: ['patientId', 'therapistId', 'meetingId'],
        indexPredicate: 'meeting_id IS NOT NULL',
      },
    );
    expect(saved).toBe(row);
  });

  it('per-meeting mark transitions update the exact (patient, therapist, meeting) row', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    const meetingId = randomUUID();
    await repository.markMeetingRunning(patientId, therapistId, meetingId);
    expect(repoMock.update).toHaveBeenCalledWith(
      { patientId, therapistId, meetingId },
      { status: 'running' },
    );
    await repository.markMeetingFailed(patientId, therapistId, meetingId, 'נכשל');
    expect(repoMock.update).toHaveBeenCalledWith(
      { patientId, therapistId, meetingId },
      { status: 'failed', error: 'נכשל' },
    );
  });

  it('findReadySummaries filters ready rows for the patient AND therapist, ordered by start time', async () => {
    const patientId = randomUUID();
    const therapistId = randomUUID();
    queryBuilder.getMany.mockResolvedValue([
      { meetingId: 'm1', text: 'סיכום' },
      { meetingId: 'm2', text: null },
    ]);
    const summaries = await repository.findReadySummaries(patientId, therapistId);
    expect(summaries).toEqual([
      { meetingId: 'm1', text: 'סיכום' },
      { meetingId: 'm2', text: '' },
    ]);
    expect(queryBuilder.where).toHaveBeenCalledWith('event.patientId = :patientId', { patientId });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('event.therapistId = :therapistId', {
      therapistId,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('summary.status = :status', {
      status: 'ready',
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('event.startAt', 'ASC');
  });

  it('failStrandedRunning reports the affected row count (0 when undefined)', async () => {
    repoMock.update.mockResolvedValue({ affected: 3 });
    await expect(repository.failStrandedRunning('interrupted')).resolves.toBe(3);
    expect(repoMock.update).toHaveBeenCalledWith(
      { status: 'running' },
      { status: 'failed', error: 'interrupted' },
    );
    repoMock.update.mockResolvedValue({});
    await expect(repository.failStrandedRunning('interrupted')).resolves.toBe(0);
  });
});
