import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode } from '../common/mock-mode';
import { TranscriptsModule } from '../transcripts/transcripts.module';
import { MeetingSummary } from './entities/meeting-summary.entity';
import { NoopSummarizer, SUMMARIZER } from './summarizer.interface';
import { NoopSummaryQueue, SUMMARY_QUEUE } from './summary-queue';

/**
 * Foundation skeleton — the summaries worker adds the /meetings controller,
 * repository (real + mock), Anthropic summarizer, and the real SUMMARY_QUEUE.
 */
@Module({
  imports: [
    ...(isMockMode() ? [] : [TypeOrmModule.forFeature([MeetingSummary])]),
    TranscriptsModule,
  ],
  providers: [
    { provide: SUMMARY_QUEUE, useClass: NoopSummaryQueue },
    { provide: SUMMARIZER, useClass: NoopSummarizer },
  ],
  exports: [SUMMARY_QUEUE, SUMMARIZER],
})
export class SummariesModule {}
