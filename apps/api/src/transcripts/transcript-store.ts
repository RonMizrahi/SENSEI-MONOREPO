import type { DiarizedSegment, Transcript } from './entities/transcript.entity';
import type { TranscriptReader } from './transcript-reader';

/** Injection token for read/write transcript persistence (audio upload flow). */
export const TRANSCRIPT_STORE = Symbol('TRANSCRIPT_STORE');

/** Fields required to persist a new transcript. */
export interface NewTranscript {
  meetingId: string;
  rawText: string;
  language: string;
  diarizedSegments: DiarizedSegment[];
}

/** Transcript persistence — a superset of the frozen TranscriptReader seam. */
export interface TranscriptStore extends TranscriptReader {
  /** True when a transcript already exists for the meeting (1:1 rule). */
  existsByMeetingId(meetingId: string): Promise<boolean>;
  /** Persists a new transcript and returns the stored row. */
  create(transcript: NewTranscript): Promise<Transcript>;
}
