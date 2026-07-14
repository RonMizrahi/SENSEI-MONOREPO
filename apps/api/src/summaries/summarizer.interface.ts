/**
 * Cross-module seam (foundation-frozen contract): transcript → clinical summary.
 * The summaries worker supplies the Anthropic + mock implementations.
 */
export const SUMMARIZER = Symbol('SUMMARIZER');

/** Result of one summarization run. */
export interface SummaryResult {
  text: string;
  /** Model identifier that produced the text (e.g. 'claude-haiku-4-5'). */
  model: string;
}

/** LLM summarizer — Anthropic Claude in production, canned mock otherwise. */
export interface Summarizer {
  /**
   * Summarizes a meeting transcript (Hebrew clinical summary).
   * @param text Full transcript text.
   * @throws Error when the upstream service rejects or fails.
   */
  summarize(text: string): Promise<SummaryResult>;
}

/** No-op default so the app boots before the summaries unit lands. */
export class NoopSummarizer implements Summarizer {
  /** Rejects — replaced by the summaries worker's implementations. */
  summarize(): Promise<SummaryResult> {
    return Promise.reject(new Error('Summarization is not implemented yet'));
  }
}
