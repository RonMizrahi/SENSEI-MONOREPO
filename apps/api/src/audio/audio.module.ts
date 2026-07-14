import { Module } from '@nestjs/common';
import { provideMockSwappable } from '../common/mock-mode';
import { SummariesModule } from '../summaries/summaries.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { TranscriptsModule } from '../transcripts/transcripts.module';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { AudioStorageService } from './audio-storage.service';
import {
  MockUploadTargetsRepository,
  TypeOrmUploadTargetsRepository,
  UPLOAD_TARGETS_REPOSITORY,
  type UploadTargetsRepository,
} from './audio.repository';

/**
 * Audio upload + transcription flow — file storage in UPLOAD_DIR, speech-to-text
 * via TRANSCRIPTION_PROVIDER, transcript persistence, and summary queueing.
 */
@Module({
  imports: [TranscriptionModule, TranscriptsModule, SummariesModule],
  controllers: [AudioController],
  providers: [
    AudioService,
    AudioStorageService,
    provideMockSwappable<UploadTargetsRepository>(
      UPLOAD_TARGETS_REPOSITORY,
      TypeOrmUploadTargetsRepository,
      MockUploadTargetsRepository,
    ),
  ],
})
export class AudioModule {}
