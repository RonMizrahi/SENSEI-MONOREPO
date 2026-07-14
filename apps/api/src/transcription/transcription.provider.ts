/**
 * Cross-module seam (foundation-frozen contract): speech-to-text.
 * The audio-transcription worker supplies the ElevenLabs + mock implementations.
 */
export const TRANSCRIPTION_PROVIDER = Symbol('TRANSCRIPTION_PROVIDER');

/** One word with second-offsets from the start of the audio. */
export interface TranscribedWord {
  text: string;
  start: number;
  end: number;
}

/** Result of transcribing one audio file. */
export interface TranscriptionResult {
  text: string;
  language: string;
  words: TranscribedWord[];
}

/** Speech-to-text provider — ElevenLabs Scribe in production, seeded mock otherwise. */
export interface TranscriptionProvider {
  /**
   * Transcribes an audio buffer.
   * @param data Raw audio bytes.
   * @param filename Original filename (extension hints the container format).
   * @throws Error when the upstream service rejects or fails.
   */
  transcribe(data: Buffer, filename: string): Promise<TranscriptionResult>;
}

/** No-op default so the app boots before the audio-transcription unit lands. */
export class NoopTranscriptionProvider implements TranscriptionProvider {
  /** Rejects — replaced by the audio-transcription worker's implementations. */
  transcribe(): Promise<TranscriptionResult> {
    return Promise.reject(new Error('Transcription is not implemented yet'));
  }
}
