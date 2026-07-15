import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { Summarizer, SummaryResult } from './summarizer.interface';
import { THERAPIST_SUMMARY_SYSTEM_PROMPT } from './summary.prompt';

/** Output ceiling for one clinical summary — well above the four-section draft length. */
const MAX_SUMMARY_OUTPUT_TOKENS = 2048;

/**
 * Production summarizer — Anthropic Claude (model from SUMMARY_MODEL) with the
 * Hebrew therapist-summary system prompt; the transcript is the user content.
 */
@Injectable()
export class AnthropicSummarizer implements Summarizer {
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Summarizes a transcript into a Hebrew clinical session summary.
   * @param text Full transcript text.
   * @throws Error when ANTHROPIC_API_KEY is missing, the API rejects, or the model returns nothing.
   */
  async summarize(text: string): Promise<SummaryResult> {
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured — summary generation is unavailable');
    }
    const model = this.config.get('SUMMARY_MODEL', { infer: true });
    this.client ??= new Anthropic({ apiKey });

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model,
        max_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
        system: THERAPIST_SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      });
    } catch (error) {
      // senseiAPI parity — the row's error field carries a wrapped, readable reason
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`summarization failed: ${reason}`, { cause: error });
    }

    let summaryText = '';
    for (const block of response.content) {
      if (block.type === 'text') summaryText += block.text;
    }
    summaryText = summaryText.trim();
    if (!summaryText) {
      throw new Error('the model returned an empty summary');
    }
    return { text: summaryText, model };
  }
}
