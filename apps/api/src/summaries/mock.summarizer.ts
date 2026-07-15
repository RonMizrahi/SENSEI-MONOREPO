import { Injectable } from '@nestjs/common';
import { SEED_MOCK_MODEL, SEED_SUMMARY_TEXT } from '../mock/seed';
import { Summarizer, SummaryResult } from './summarizer.interface';

/** MOCK_MODE summarizer — returns the canned Hebrew clinical summary instantly. */
@Injectable()
export class MockSummarizer implements Summarizer {
  /** Resolves with the seeded summary text tagged with the mock model. */
  summarize(): Promise<SummaryResult> {
    return Promise.resolve({ text: SEED_SUMMARY_TEXT, model: SEED_MOCK_MODEL });
  }
}
