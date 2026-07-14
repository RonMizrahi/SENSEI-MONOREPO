import { Injectable } from '@nestjs/common';

/**
 * Cross-module seam (foundation-frozen contract): fire-and-forget summary jobs.
 * The audio upload flow enqueues through this token; the summaries worker
 * supplies the real in-process implementation (status row + async generation).
 */
export const SUMMARY_QUEUE = Symbol('SUMMARY_QUEUE');

/** Queues summary generation for a meeting. */
export interface SummaryQueue {
  /**
   * Creates/resets the pending summary row and starts generation asynchronously.
   * Never throws — failures land on the summary row, not the caller.
   */
  enqueue(meetingId: string): Promise<void>;
}

/** No-op default so the app boots before the summaries unit lands. */
@Injectable()
export class NoopSummaryQueue implements SummaryQueue {
  /** Does nothing — replaced by the summaries worker's implementation. */
  enqueue(): Promise<void> {
    return Promise.resolve();
  }
}
