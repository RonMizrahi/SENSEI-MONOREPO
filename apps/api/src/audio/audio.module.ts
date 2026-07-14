import { Module } from '@nestjs/common';
import { SummariesModule } from '../summaries/summaries.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { TranscriptsModule } from '../transcripts/transcripts.module';

/**
 * Foundation skeleton — the audio-transcription worker adds the upload/list/
 * get/delete/transcribe endpoints, file storage, and transcript persistence.
 */
@Module({
  imports: [TranscriptionModule, TranscriptsModule, SummariesModule],
})
export class AudioModule {}
