import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { TranscriptsModule } from '../transcripts/transcripts.module';
import { AnthropicSummarizer } from './anthropic.summarizer';
import { MeetingSummary } from './entities/meeting-summary.entity';
import { MockSummarizer } from './mock.summarizer';
import { SummariesController } from './summaries.controller';
import {
  SUMMARIES_REPOSITORY,
  SummariesMockRepository,
  SummariesTypeormRepository,
  type SummariesRepository,
} from './summaries.repository';
import { SummariesService } from './summaries.service';
import { SUMMARIZER, type Summarizer } from './summarizer.interface';
import { SUMMARY_QUEUE } from './summary-queue';
import { InProcessSummaryQueue } from './summary-queue.service';

/**
 * AI meeting summaries — /meetings/{id}/summary endpoints, the in-process
 * SUMMARY_QUEUE (fire-and-forget generation + restart sweep), and the
 * Anthropic/mock SUMMARIZER pair, all mock-swappable via MOCK_MODE.
 */
@Module({
  imports: [
    ...(isMockMode() ? [] : [TypeOrmModule.forFeature([MeetingSummary])]),
    TranscriptsModule,
  ],
  controllers: [SummariesController],
  providers: [
    SummariesService,
    provideMockSwappable<SummariesRepository>(
      SUMMARIES_REPOSITORY,
      SummariesTypeormRepository,
      SummariesMockRepository,
    ),
    provideMockSwappable<Summarizer>(SUMMARIZER, AnthropicSummarizer, MockSummarizer),
    { provide: SUMMARY_QUEUE, useClass: InProcessSummaryQueue },
  ],
  exports: [SUMMARY_QUEUE, SUMMARIZER, SUMMARIES_REPOSITORY],
})
export class SummariesModule {}
