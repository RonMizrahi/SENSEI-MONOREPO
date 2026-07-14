/* eslint-disable @typescript-eslint/unbound-method -- jest mock call assertions */
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
    meetingExists: jest.fn(),
  };
}

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

  beforeEach(() => {
    repository = makeRepository();
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new SummariesService(repository, queue);
  });

  describe('getSummary', () => {
    it('throws 404 when no summary row exists', async () => {
      repository.findByMeetingId.mockResolvedValue(null);

      await expect(service.getSummary(meetingId)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('maps a ready row to the snake_case body', async () => {
      repository.findByMeetingId.mockResolvedValue(
        makeRow({ meetingId, status: 'ready', text: 'סיכום', model: 'm1' }),
      );

      await expect(service.getSummary(meetingId)).resolves.toEqual({
        meeting_id: meetingId,
        status: 'ready',
        text: 'סיכום',
        model: 'm1',
        error: null,
      });
    });

    it('maps an empty model to null (Python parity)', async () => {
      repository.findByMeetingId.mockResolvedValue(makeRow({ meetingId, model: '' }));

      const body = await service.getSummary(meetingId);

      expect(body.model).toBeNull();
    });

    it('a failed row is returned with its error', async () => {
      repository.findByMeetingId.mockResolvedValue(
        makeRow({ meetingId, status: 'failed', error: 'boom' }),
      );

      const body = await service.getSummary(meetingId);

      expect(body.status).toBe('failed');
      expect(body.error).toBe('boom');
    });
  });

  describe('requestSummary', () => {
    it('throws 404 when the meeting does not exist and never enqueues', async () => {
      repository.meetingExists.mockResolvedValue(false);

      await expect(service.requestSummary(meetingId)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues and returns the pending body', async () => {
      repository.meetingExists.mockResolvedValue(true);

      await expect(service.requestSummary(meetingId)).resolves.toEqual({
        meeting_id: meetingId,
        status: 'pending',
        text: null,
        model: null,
        error: null,
      });
      expect(queue.enqueue).toHaveBeenCalledWith(meetingId);
    });
  });
});
