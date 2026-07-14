import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import { Transcript } from './entities/transcript.entity';
import { MockTranscriptsRepository } from './mock-transcripts.repository';
import type { NewTranscript } from './transcript-store';
import { TranscriptsRepository } from './transcripts.repository';

const newTranscript = (meetingId: string): NewTranscript => ({
  meetingId,
  rawText: 'טקסט הפגישה',
  language: 'he',
  diarizedSegments: [{ speaker: 'unknown', start_time: 0, end_time: 0.4, text: 'טקסט' }],
});

describe('MockTranscriptsRepository', () => {
  let repository: MockTranscriptsRepository;
  let meetingId: string;

  beforeEach(() => {
    repository = new MockTranscriptsRepository();
    meetingId = randomUUID();
  });

  it('reports no transcript before one is created', async () => {
    await expect(repository.existsByMeetingId(meetingId)).resolves.toBe(false);
    await expect(repository.getByMeetingId(meetingId)).resolves.toBeNull();
  });

  it('stores and retrieves a transcript by meeting id', async () => {
    const created = await repository.create(newTranscript(meetingId));
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.meetingId).toBe(meetingId);
    expect(created.createdAt).toBeInstanceOf(Date);
    await expect(repository.existsByMeetingId(meetingId)).resolves.toBe(true);
    await expect(repository.getByMeetingId(meetingId)).resolves.toEqual(created);
  });
});

describe('TranscriptsRepository', () => {
  const findOne = jest.fn();
  const existsBy = jest.fn();
  const create = jest.fn();
  const save = jest.fn();
  const typeormRepository = {
    findOne,
    existsBy,
    create,
    save,
  } as unknown as Repository<Transcript>;
  const repository = new TranscriptsRepository(typeormRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds a transcript by meeting id', async () => {
    const meetingId = randomUUID();
    const row = new Transcript();
    findOne.mockResolvedValue(row);
    await expect(repository.getByMeetingId(meetingId)).resolves.toBe(row);
    expect(findOne).toHaveBeenCalledWith({ where: { meetingId } });
  });

  it('checks existence by meeting id', async () => {
    const meetingId = randomUUID();
    existsBy.mockResolvedValue(true);
    await expect(repository.existsByMeetingId(meetingId)).resolves.toBe(true);
    expect(existsBy).toHaveBeenCalledWith({ meetingId });
  });

  it('creates and saves a new transcript row', async () => {
    const meetingId = randomUUID();
    const input = newTranscript(meetingId);
    const entity = new Transcript();
    create.mockReturnValue(entity);
    save.mockResolvedValue(entity);
    await expect(repository.create(input)).resolves.toBe(entity);
    expect(create).toHaveBeenCalledWith(input);
    expect(save).toHaveBeenCalledWith(entity);
  });
});
