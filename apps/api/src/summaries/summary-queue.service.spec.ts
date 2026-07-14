/* eslint-disable @typescript-eslint/unbound-method -- jest mock call assertions */
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import type { Transcript } from '../transcripts/entities/transcript.entity';
import type { TranscriptReader } from '../transcripts/transcript-reader';
import type { SummariesRepository } from './summaries.repository';
import type { Summarizer } from './summarizer.interface';
import {
  INTERRUPTED_BY_RESTART_ERROR,
  InProcessSummaryQueue,
  NO_TRANSCRIPT_ERROR,
  SUMMARY_DISABLED_ERROR,
} from './summary-queue.service';

const MAX_CHARS = 100;

function makeTranscript(rawText: string): Transcript {
  return {
    id: crypto.randomUUID(),
    meetingId: crypto.randomUUID(),
    rawText,
    diarizedSegments: [],
    language: 'he',
    createdAt: new Date(),
  };
}

function makeRepository(): jest.Mocked<SummariesRepository> {
  return {
    createPending: jest.fn().mockResolvedValue(undefined),
    markRunning: jest.fn().mockResolvedValue(undefined),
    markReady: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    findByMeetingId: jest.fn().mockResolvedValue(null),
    failAllRunning: jest.fn().mockResolvedValue(0),
    meetingExists: jest.fn().mockResolvedValue(true),
  };
}

/** Drains the microtask queue so the fire-and-forget generation completes. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('InProcessSummaryQueue', () => {
  let repository: jest.Mocked<SummariesRepository>;
  let summarizer: jest.Mocked<Summarizer>;
  let transcripts: jest.Mocked<TranscriptReader>;
  let queue: InProcessSummaryQueue;
  const meetingId = crypto.randomUUID();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  /** Builds a config mock covering the queue's two knobs. */
  function makeConfig(summaryEnabled: boolean): ConfigService<Env, true> {
    return {
      get: jest.fn((key: string) => (key === 'SUMMARY_ENABLED' ? summaryEnabled : MAX_CHARS)),
    } as unknown as ConfigService<Env, true>;
  }

  beforeEach(() => {
    repository = makeRepository();
    summarizer = { summarize: jest.fn().mockResolvedValue({ text: 'סיכום', model: 'm1' }) };
    transcripts = { getByMeetingId: jest.fn().mockResolvedValue(makeTranscript('שיחה קצרה')) };
    queue = new InProcessSummaryQueue(repository, summarizer, transcripts, makeConfig(true));
  });

  it('enqueue creates the pending row and generation lands ready', async () => {
    await queue.enqueue(meetingId);
    await flushAsync();

    expect(repository.createPending).toHaveBeenCalledWith(meetingId);
    expect(repository.markRunning).toHaveBeenCalledWith(meetingId);
    expect(repository.markReady).toHaveBeenCalledWith(meetingId, 'סיכום', 'm1');
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('marks failed when the meeting has no transcript', async () => {
    transcripts.getByMeetingId.mockResolvedValue(null);

    await queue.enqueue(meetingId);
    await flushAsync();

    expect(repository.markFailed).toHaveBeenCalledWith(meetingId, NO_TRANSCRIPT_ERROR);
    expect(repository.markRunning).not.toHaveBeenCalled();
    expect(summarizer.summarize).not.toHaveBeenCalled();
  });

  it('marks failed with a clear message when the transcript exceeds the limit', async () => {
    const longText = 'א'.repeat(MAX_CHARS + 1);
    transcripts.getByMeetingId.mockResolvedValue(makeTranscript(longText));

    await queue.enqueue(meetingId);
    await flushAsync();

    expect(repository.markFailed).toHaveBeenCalledWith(
      meetingId,
      `transcript exceeds the context window (${longText.length} chars > ${MAX_CHARS})`,
    );
    expect(repository.markRunning).not.toHaveBeenCalled();
  });

  it('a summarizer failure lands on the row, not the caller', async () => {
    summarizer.summarize.mockRejectedValue(new Error('upstream exploded'));

    await expect(queue.enqueue(meetingId)).resolves.toBeUndefined();
    await flushAsync();

    expect(repository.markRunning).toHaveBeenCalledWith(meetingId);
    expect(repository.markFailed).toHaveBeenCalledWith(meetingId, 'upstream exploded');
  });

  it('never rejects the caller when createPending itself fails', async () => {
    repository.createPending.mockRejectedValue(new Error('db down'));

    await expect(queue.enqueue(meetingId)).resolves.toBeUndefined();
    await flushAsync();

    expect(transcripts.getByMeetingId).not.toHaveBeenCalled();
  });

  it('a repository failure mid-generation still marks the row failed', async () => {
    repository.markReady.mockRejectedValue(new Error('write failed'));

    await queue.enqueue(meetingId);
    await flushAsync();

    expect(repository.markFailed).toHaveBeenCalledWith(meetingId, 'write failed');
  });

  it('never surfaces an unhandled rejection even when the failure write fails too', async () => {
    repository.markRunning.mockRejectedValue(new Error('first failure'));
    repository.markFailed.mockRejectedValue(new Error('second failure'));

    await expect(queue.enqueue(meetingId)).resolves.toBeUndefined();
    await expect(flushAsync()).resolves.toBeUndefined();
  });

  it('startup sweep fails all rows stranded in running', async () => {
    repository.failAllRunning.mockResolvedValue(2);

    await queue.onApplicationBootstrap();

    expect(repository.failAllRunning).toHaveBeenCalledWith(INTERRUPTED_BY_RESTART_ERROR);
  });

  it('startup sweep tolerates repository failures — boot must not crash', async () => {
    repository.failAllRunning.mockRejectedValue(new Error('relation does not exist'));

    await expect(queue.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('SUMMARY_ENABLED=false marks the row failed without touching transcripts or the model', async () => {
    queue = new InProcessSummaryQueue(repository, summarizer, transcripts, makeConfig(false));

    await queue.enqueue(meetingId);
    await flushAsync();

    expect(repository.markFailed).toHaveBeenCalledWith(meetingId, SUMMARY_DISABLED_ERROR);
    expect(transcripts.getByMeetingId).not.toHaveBeenCalled();
    expect(summarizer.summarize).not.toHaveBeenCalled();
  });

  it('SUMMARY_ENABLED=false skips the startup sweep (senseiAPI parity)', async () => {
    queue = new InProcessSummaryQueue(repository, summarizer, transcripts, makeConfig(false));

    await queue.onApplicationBootstrap();

    expect(repository.failAllRunning).not.toHaveBeenCalled();
  });
});
