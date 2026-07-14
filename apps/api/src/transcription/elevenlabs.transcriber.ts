import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../config/env.schema';
import type {
  TranscribedWord,
  TranscriptionProvider,
  TranscriptionResult,
} from './transcription.provider';

/** ElevenLabs speech-to-text endpoint (Scribe). */
export const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

const ERROR_BODY_PREVIEW_CHARS = 300;

/** Only entries of this type carry spoken words (others: spacing, audio_event). */
const WORD_ENTRY_TYPE = 'word';

const elevenLabsWordSchema = z.object({
  text: z.string(),
  type: z.string(),
  start: z.number().default(0),
  end: z.number().default(0),
});

/** The slice of the ElevenLabs response the API consumes. */
export const elevenLabsResponseSchema = z.object({
  text: z.string(),
  words: z.array(elevenLabsWordSchema).default([]),
});

/**
 * Speech-to-text via the ElevenLabs REST API (Scribe) using global fetch.
 * Mirrors senseiAPI's ElevenLabsTranscriber: word-level timestamps, and the
 * requested language reported back (Scribe answers in ISO-639-3 codes).
 */
@Injectable()
export class ElevenLabsTranscriber implements TranscriptionProvider {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Transcribes an audio buffer through ElevenLabs Scribe.
   * @throws Error when the API key is missing or the request fails.
   */
  async transcribe(data: Buffer, filename: string): Promise<TranscriptionResult> {
    const apiKey = this.config.get('ELEVENLABS_API_KEY', { infer: true });
    if (apiKey === undefined || apiKey === '') {
      throw new Error('ELEVENLABS_API_KEY is not configured — set it or run with MOCK_MODE=true');
    }
    const language = this.config.get('TRANSCRIBE_LANGUAGE', { infer: true });

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(data)]), filename);
    form.append('model_id', this.config.get('ELEVENLABS_MODEL', { infer: true }));
    form.append('language_code', language);
    form.append('timestamps_granularity', WORD_ENTRY_TYPE);

    const response = await fetch(ELEVENLABS_STT_URL, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `ElevenLabs transcription failed (${response.status}): ${body.slice(0, ERROR_BODY_PREVIEW_CHARS)}`,
      );
    }

    const parsed = elevenLabsResponseSchema.parse(await response.json());
    const words: TranscribedWord[] = parsed.words
      .filter((word) => word.type === WORD_ENTRY_TYPE)
      .map((word) => ({ text: word.text, start: word.start, end: word.end }));
    // Report the language we asked for, not Scribe's ISO-639-3 answer (parity).
    return { text: parsed.text, language, words };
  }
}
