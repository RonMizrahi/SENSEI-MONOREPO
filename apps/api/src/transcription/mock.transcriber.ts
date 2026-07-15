import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import type {
  TranscribedWord,
  TranscriptionProvider,
  TranscriptionResult,
} from './transcription.provider';

/** Canned Hebrew session transcript served in MOCK_MODE. */
export const MOCK_TRANSCRIPT_TEXT = [
  'שלום, טוב לראות אותך שוב השבוע.',
  'בפגישה הקודמת דיברנו על הלחץ בעבודה ועל קשיי השינה.',
  'השבוע ניסיתי את תרגילי הנשימה וזה עזר לי להירדם מהר יותר.',
  'נמשיך לתרגל יחד ונבחן מה עוד אפשר לשפר בסדר היום.',
].join(' ');

/** Fixed per-word duration for the fabricated timestamps (seconds). */
const MOCK_WORD_DURATION_SECONDS = 0.4;

/**
 * Deterministic MOCK_MODE transcriber — returns the canned Hebrew text with
 * fabricated word timings, so the full upload flow runs without any API key.
 */
@Injectable()
export class MockTranscriber implements TranscriptionProvider {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Returns the canned Hebrew transcript with evenly spaced word timings. */
  transcribe(): Promise<TranscriptionResult> {
    const words: TranscribedWord[] = MOCK_TRANSCRIPT_TEXT.split(' ').map((text, index) => ({
      text,
      start: index * MOCK_WORD_DURATION_SECONDS,
      end: (index + 1) * MOCK_WORD_DURATION_SECONDS,
    }));
    return Promise.resolve({
      text: MOCK_TRANSCRIPT_TEXT,
      language: this.config.get('TRANSCRIBE_LANGUAGE', { infer: true }),
      words,
    });
  }
}
