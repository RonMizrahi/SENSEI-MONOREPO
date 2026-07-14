import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode } from '../common/mock-mode';
import { Transcript } from './entities/transcript.entity';
import { NoopTranscriptReader, TRANSCRIPT_READER } from './transcript-reader';

/**
 * Foundation skeleton — the audio-transcription worker replaces the no-op
 * TRANSCRIPT_READER with the persistence-backed implementation.
 */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([Transcript])])],
  providers: [{ provide: TRANSCRIPT_READER, useClass: NoopTranscriptReader }],
  exports: [TRANSCRIPT_READER],
})
export class TranscriptsModule {}
