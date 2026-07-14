import type { ReadyMeetingSummary } from './reports.repository';

/** Injection token for the prep-report generator (Anthropic in production, canned mock in MOCK_MODE). */
export const REPORT_GENERATOR = Symbol('REPORT_GENERATOR');

/** Structured content produced by one generation run. */
export interface GeneratedReport {
  intro: string;
  changes: string[];
  openTopics: string[];
  /** Model identifier that produced the report (e.g. 'claude-haiku-4-5'). */
  model: string;
}

/** Turns a patient's ready meeting summaries into a next-meeting prep report. */
export interface ReportGenerator {
  /**
   * Generates the prep report from the summaries (ordered oldest → newest).
   * @throws Error when the upstream call fails or its output is unparsable.
   */
  generate(summaries: ReadyMeetingSummary[]): Promise<GeneratedReport>;
}
