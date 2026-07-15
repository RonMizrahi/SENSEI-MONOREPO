/* eslint-disable @typescript-eslint/unbound-method -- jest mock call assertions */
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import type { MeetingSummary } from './entities/meeting-summary.entity';
import type { SummariesRepository } from './summaries.repository';
import { SummariesService } from './summaries.service';
import type { SummaryQueue } from './summary-queue';

function makeRepository(): jest.Mocked<SummariesRepository> {
  return {
    createPending: jest.fn(),
    markRunning: jest.fn(),
    markReady: jest.fn(),
    markFailed: jest.fn(),
    findByMeetingId: jest.fn(),
    failAllRunning: jest.fn(),
    meetingBelongsToTherapist: jest.fn(),
  };
}

const makeUser = (userId: string): AuthenticatedUser => ({
  userId,
  email: 'therapist@test.local',
  fullName: 'Test Therapist',
  role: 'therapist',
});

function makeRow(overrides: Partial<MeetingSummary>): MeetingSummary {
  return {
    id: crypto.randomUUID(),
    meetingId: crypto.randomUUID(),
    status: 'pending',
    text: null,
    model: '',
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SummariesService', () => {
  let repository: jest.Mocked<SummariesRepository>;
  let queue: jest.Mocked<SummaryQueue>;
  let service: SummariesService;
  const meetingId = crypto.randomUUID();
  const user = makeUser(crypto.randomUUID());

  beforeEach(() => {
    repository = makeRepository();
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new SummariesService(repository, queue);
    repository.meetingBelongsToTherapist.mockResolvedValue(true);
  });

  describe('getSummary', () => {
    it('throws 404 when the meeting is not the caller’s and never reads the row', async () => {
      repository.meetingBelongsToTherapist.mockResolvedValue(false);

      await expect(service.getSummary(user, meetingId)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.findByMeetingId).not.toHaveBeenCalled();
    });

    it('throws 404 when no summary row exists', async () => {
      repository.findByMeetingId.mockResolvedValue(null);

      await expect(service.getSummary(user, meetingId)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('maps a ready row to the snake_case body', async () => {
      repository.findByMeetingId.mockResolvedValue(
        makeRow({ meetingId, status: 'ready', text: 'סיכום', model: 'm1' }),
      );

      await expect(service.getSummary(user, meetingId)).resolves.toEqual({
        meeting_id: meetingId,
        status: 'ready',
        text: 'סיכום',
        model: 'm1',
        error: null,
      });
      expect(repository.meetingBelongsToTherapist).toHaveBeenCalledWith(meetingId, user.userId);
    });

    it('maps an empty model to null (Python parity)', async () => {
      repository.findByMeetingId.mockResolvedValue(makeRow({ meetingId, model: '' }));

      const body = await service.getSummary(user, meetingId);

      expect(body.model).toBeNull();
    });

    it('a failed row is returned with its error', async () => {
      repository.findByMeetingId.mockResolvedValue(
        makeRow({ meetingId, status: 'failed', error: 'boom' }),
      );

      const body = await service.getSummary(user, meetingId);

      expect(body.status).toBe('failed');
      expect(body.error).toBe('boom');
    });
  });

  describe('requestSummary', () => {
    it('throws 404 when the meeting is not the caller’s and never enqueues', async () => {
      repository.meetingBelongsToTherapist.mockResolvedValue(false);

      await expect(service.requestSummary(user, meetingId)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues and returns the pending body', async () => {
      repository.meetingBelongsToTherapist.mockResolvedValue(true);

      await expect(service.requestSummary(user, meetingId)).resolves.toEqual({
        meeting_id: meetingId,
        status: 'pending',
        text: null,
        model: null,
        error: null,
        insight: null,
      });
      expect(repository.meetingBelongsToTherapist).toHaveBeenCalledWith(meetingId, user.userId);
      expect(queue.enqueue).toHaveBeenCalledWith(meetingId);
    });
  });
});
