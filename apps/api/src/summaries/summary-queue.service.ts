import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { TRANSCRIPT_READER, type TranscriptReader } from '../transcripts/transcript-reader';
import { SUMMARIES_REPOSITORY, type SummariesRepository } from './summaries.repository';
import { SUMMARIZER, type Summarizer } from './summarizer.interface';
import type { SummaryQueue } from './summary-queue';

/** Error written to rows stranded in 'running' by a server restart (senseiAPI parity). */
export const INTERRUPTED_BY_RESTART_ERROR = 'generation was interrupted by a server restart';

/** Error written when the meeting has no stored transcript (senseiAPI parity). */
export const NO_TRANSCRIPT_ERROR = 'no transcript for this meeting';

/** Error written when the operator disabled generation via SUMMARY_ENABLED=false. */
export const SUMMARY_DISABLED_ERROR = 'summary generation is disabled (SUMMARY_ENABLED=false)';

/**
 * In-process summary queue — pending row now, generation fired asynchronously.
 * Nothing awaits the generation task, so every terminal state (ready/failed)
 * is written to the summary row instead of surfacing to a caller.
 */
@Injectable()
export class InProcessSummaryQueue implements SummaryQueue, OnApplicationBootstrap {
  private readonly logger = new Logger(InProcessSummaryQueue.name);

  constructor(
    @Inject(SUMMARIES_REPOSITORY) private readonly summaries: SummariesRepository,
    @Inject(SUMMARIZER) private readonly summarizer: Summarizer,
    @Inject(TRANSCRIPT_READER) private readonly transcripts: TranscriptReader,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Startup sweep — in-process jobs die with the server, so a killed generation
   * leaves its row in 'running' forever unless it is failed here. A sweep failure
   * is logged but never blocks boot; the next restart sweeps again.
   */
  async onApplicationBootstrap(): Promise<void> {
    // senseiAPI parity — the sweep is part of the summaries feature and honors its kill switch
    if (!this.config.get('SUMMARY_ENABLED', { infer: true })) return;
    try {
      const swept = await this.summaries.failAllRunning(INTERRUPTED_BY_RESTART_ERROR);
      if (swept > 0) {
        this.logger.warn(`failed ${swept} summaries interrupted by restart`);
      }
    } catch (error) {
      this.logger.error('startup sweep of running summaries failed', toStack(error));
    }
  }

  /**
   * Creates/resets the pending row and starts generation without awaiting it.
   * Never rejects — failures land on the summary row, not the caller.
   */
  async enqueue(meetingId: string): Promise<void> {
    try {
      await this.summaries.createPending(meetingId);
    } catch (error) {
      this.logger.error(`failed to create pending summary for meeting ${meetingId}`, toStack(error));
      return;
    }
    void this.generate(meetingId).catch(async (error: unknown) => {
      // last resort — an escaping error must not strand the row in 'running'
      this.logger.error(`summary generation failed for meeting ${meetingId}`, toStack(error));
      try {
        await this.summaries.markFailed(meetingId, toMessage(error));
      } catch (markError) {
        this.logger.error(
          `failed to record summary failure for meeting ${meetingId}`,
          toStack(markError),
        );
      }
    });
  }

  /** Runs one generation: kill switch → transcript → gates → summarize → ready/failed on the row. */
  private async generate(meetingId: string): Promise<void> {
    // never reach the AI provider when the operator disabled summaries
    if (!this.config.get('SUMMARY_ENABLED', { infer: true })) {
      await this.summaries.markFailed(meetingId, SUMMARY_DISABLED_ERROR);
      return;
    }

    const transcript = await this.transcripts.getByMeetingId(meetingId);
    if (!transcript) {
      await this.summaries.markFailed(meetingId, NO_TRANSCRIPT_ERROR);
      return;
    }

    // an over-long transcript would silently summarize a fragment — fail visibly instead
    const maxChars = this.config.get('MAX_TRANSCRIPT_CHARS', { infer: true });
    if (transcript.rawText.length > maxChars) {
      await this.summaries.markFailed(
        meetingId,
        `transcript exceeds the context window (${transcript.rawText.length} chars > ${maxChars})`,
      );
      return;
    }

    await this.summaries.markRunning(meetingId);
    try {
      const summary = await this.summarizer.summarize(transcript.rawText);
      await this.summaries.markReady(meetingId, summary.text, summary.model);
    } catch (error) {
      await this.summaries.markFailed(meetingId, toMessage(error));
    }
  }
}

/** Extracts a human-readable message from an unknown thrown value. */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Extracts a stack trace (or printable form) for logging. */
function toStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : String(error);
}
