import { Module } from '@nestjs/common';
import {
  NoopTranscriptionProvider,
  TRANSCRIPTION_PROVIDER,
} from './transcription.provider';

/**
 * Foundation skeleton — the audio-transcription worker replaces the no-op
 * TRANSCRIPTION_PROVIDER with the ElevenLabs + mock implementations.
 */
@Module({
  providers: [{ provide: TRANSCRIPTION_PROVIDER, useClass: NoopTranscriptionProvider }],
  exports: [TRANSCRIPTION_PROVIDER],
})
export class TranscriptionModule {}
