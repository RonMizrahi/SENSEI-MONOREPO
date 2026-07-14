import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { Transcript } from './entities/transcript.entity';
import { MockTranscriptsRepository } from './mock-transcripts.repository';
import { TRANSCRIPT_READER } from './transcript-reader';
import { TRANSCRIPT_STORE, type TranscriptStore } from './transcript-store';
import { TranscriptsRepository } from './transcripts.repository';

/**
 * Transcript persistence — TypeORM-backed in real mode, in-memory in MOCK_MODE.
 * TRANSCRIPT_READER (frozen seam, consumed by summaries) resolves to the same
 * instance as the read/write TRANSCRIPT_STORE used by the audio upload flow.
 */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([Transcript])])],
  providers: [
    provideMockSwappable<TranscriptStore>(
      TRANSCRIPT_STORE,
      TranscriptsRepository,
      MockTranscriptsRepository,
    ),
    { provide: TRANSCRIPT_READER, useExisting: TRANSCRIPT_STORE },
  ],
  exports: [TRANSCRIPT_READER, TRANSCRIPT_STORE],
})
export class TranscriptsModule {}
