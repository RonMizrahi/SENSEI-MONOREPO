import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { SEED_EVENTS, SEED_PATIENTS, SEED_USER } from '../mock/seed';
import { MockUploadTargetsRepository, TypeOrmUploadTargetsRepository } from './audio.repository';

describe('MockUploadTargetsRepository', () => {
  const repository = new MockUploadTargetsRepository();

  it('finds a seeded meeting with its owner and patient linkage', async () => {
    const seeded = SEED_EVENTS[0];
    await expect(repository.findMeeting(seeded.id)).resolves.toEqual({
      id: seeded.id,
      therapistId: SEED_USER.id,
      patientId: seeded.patientId,
    });
  });

  it('returns null for an unknown meeting', async () => {
    await expect(repository.findMeeting(randomUUID())).resolves.toBeNull();
  });

  it('knows the seeded patients and rejects unknown ones', async () => {
    await expect(repository.patientExists(SEED_PATIENTS[0].id)).resolves.toBe(true);
    await expect(repository.patientExists(randomUUID())).resolves.toBe(false);
  });
});

describe('TypeOrmUploadTargetsRepository', () => {
  const findOne = jest.fn();
  const existsBy = jest.fn();
  const dataSource = {
    getRepository: jest.fn().mockReturnValue({ findOne, existsBy }),
  } as unknown as DataSource;
  const repository = new TypeOrmUploadTargetsRepository(dataSource);

  beforeEach(() => {
    findOne.mockReset();
    existsBy.mockReset();
  });

  it('maps a found meeting row to id + therapistId + patientId', async () => {
    const meetingId = randomUUID();
    const patientId = randomUUID();
    const therapistId = randomUUID();
    findOne.mockResolvedValue({ id: meetingId, therapistId, patientId, title: 'פגישה' });
    await expect(repository.findMeeting(meetingId)).resolves.toEqual({
      id: meetingId,
      therapistId,
      patientId,
    });
    expect(findOne).toHaveBeenCalledWith({ where: { id: meetingId } });
  });

  it('returns null when the meeting row is absent', async () => {
    findOne.mockResolvedValue(null);
    await expect(repository.findMeeting(randomUUID())).resolves.toBeNull();
  });

  it('delegates patient existence to existsBy', async () => {
    const patientId = randomUUID();
    existsBy.mockResolvedValue(true);
    await expect(repository.patientExists(patientId)).resolves.toBe(true);
    expect(existsBy).toHaveBeenCalledWith({ id: patientId });
  });
});
