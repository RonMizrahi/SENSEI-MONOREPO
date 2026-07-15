import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { PatientReport } from './entities/patient-report.entity';
import { TypeormReportsRepository } from './reports.repository';

interface RepoMock {
  existsBy: jest.Mock;
  exists: jest.Mock;
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

  it('findByPatientId queries by the patient id', async () => {
    const patientId = randomUUID();
    repoMock.findOne.mockResolvedValue(null);
    await expect(repository.findByPatientId(patientId)).resolves.toBeNull();
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { patientId } });
  });

  it('resetToPending upserts a clean pending row keyed on patientId and returns it', async () => {
    const patientId = randomUUID();
    const row = Object.assign(new PatientReport(), { id: randomUUID(), patientId });
    repoMock.findOne.mockResolvedValue(row);
    const saved = await repository.resetToPending(patientId);
    expect(repoMock.upsert).toHaveBeenCalledWith(
      {
        patientId,
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
      ['patientId'],
    );
    expect(saved).toBe(row);
  });

  it('resetToPending throws when the upserted row cannot be read back', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(repository.resetToPending(randomUUID())).rejects.toThrow('did not persist');
  });

  it('mark transitions issue targeted updates', async () => {
    const patientId = randomUUID();
    await repository.markRunning(patientId);
    expect(repoMock.update).toHaveBeenCalledWith({ patientId }, { status: 'running' });

    await repository.markFailed(patientId, 'נכשל');
    expect(repoMock.update).toHaveBeenCalledWith({ patientId }, { status: 'failed', error: 'נכשל' });

    const generatedAt = new Date();
    await repository.markReady(patientId, {
      intro: 'מבוא',
      changes: ['שינוי'],
      openTopics: ['נושא'],
      sourceMeetingIds: ['m1'],
      lastSummaryExcerpt: 'תקציר',
      generatedAt,
      model: 'claude-test',
    });
    expect(repoMock.update).toHaveBeenCalledWith(
      { patientId },
      expect.objectContaining({ status: 'ready', intro: 'מבוא', generatedAt, error: null }),
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
