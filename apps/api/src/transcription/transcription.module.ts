import { Module } from '@nestjs/common';
import { provideMockSwappable } from '../common/mock-mode';
import { ElevenLabsTranscriber } from './elevenlabs.transcriber';
import { MockTranscriber } from './mock.transcriber';
import { TRANSCRIPTION_PROVIDER, type TranscriptionProvider } from './transcription.provider';

/**
 * Speech-to-text wiring — ElevenLabs Scribe in real mode, the canned Hebrew
 * mock in MOCK_MODE (no API key required).
 */
@Module({
  providers: [
    provideMockSwappable<TranscriptionProvider>(
      TRANSCRIPTION_PROVIDER,
      ElevenLabsTranscriber,
      MockTranscriber,
    ),
  ],
  exports: [TRANSCRIPTION_PROVIDER],
})
export class TranscriptionModule {}
