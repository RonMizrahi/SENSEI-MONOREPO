import { Injectable } from '@nestjs/common';
import type { Transcript } from './entities/transcript.entity';

/**
 * Cross-module seam (foundation-frozen contract): read access to transcripts.
 * The summaries worker consumes it; the audio-transcription worker supplies
 * the real implementation.
 */
export const TRANSCRIPT_READER = Symbol('TRANSCRIPT_READER');

/** Read-only transcript lookup used by the summary pipeline. */
export interface TranscriptReader {
  /** Returns the meeting's transcript, or null when none exists. */
  getByMeetingId(meetingId: string): Promise<Transcript | null>;
}

/** No-op default so the app boots before the audio-transcription unit lands. */
@Injectable()
export class NoopTranscriptReader implements TranscriptReader {
  /** Always null — replaced by the audio-transcription worker's implementation. */
  getByMeetingId(): Promise<Transcript | null> {
    return Promise.resolve(null);
  }
}
