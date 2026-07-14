import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { GeneratedReport, ReportGenerator } from './report-generator.interface';
import {
  MISSING_API_KEY_ERROR,
  REPORT_MAX_TOKENS,
  REPORT_PARSE_ERROR,
} from './reports.constants';
import type { ReadyMeetingSummary } from './reports.repository';

const SUMMARY_SEPARATOR = '\n\n';

/**
 * Builds the Hebrew prep-report prompt from the patient's ready summaries.
 * When the combined block exceeds maxChars the OLDEST summaries are dropped
 * first — the report is about what changed recently, so recency wins.
 */
export function buildReportPrompt(summaries: ReadyMeetingSummary[], maxChars: number): string {
  const blocks: string[] = [];
  let used = 0;
  for (let index = summaries.length - 1; index >= 0 && used < maxChars; index -= 1) {
    const block = `[פגישה ${index + 1}]\n${summaries[index].text}`.slice(0, maxChars - used);
    blocks.unshift(block);
    used += block.length + SUMMARY_SEPARATOR.length;
  }
  const summariesBlock = blocks.join(SUMMARY_SEPARATOR);
  return [
    'את/ה עוזר/ת קליני/ת למטפל/ת. לפניך סיכומי פגישות טיפוליות של מטופל/ת אחד/ת, מסודרים מהישן לחדש.',
    'הפק/הפיקי דוח הכנה לקראת הפגישה הבאה, בעברית.',
    'החזר/החזירי JSON בלבד — ללא טקסט נוסף, ללא הסברים וללא markdown — במבנה הבא:',
    '{"intro": "...", "changes": ["..."], "open_topics": ["..."]}',
    '- intro: פתיחה של 2-3 משפטים המסכמת את מצב המטופל/ת.',
    '- changes: 3-5 נקודות על "מה השתנה מאז הפגישה האחרונה".',
    '- open_topics: 3-5 נושאים פתוחים למעקב בפגישה הבאה.',
    '',
    'סיכומי הפגישות:',
    summariesBlock,
  ].join('\n');
}

/** Type guard for a plain JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a required non-empty string field, throwing REPORT_PARSE_ERROR otherwise. */
function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(REPORT_PARSE_ERROR);
  return value.trim();
}

/** Reads a required non-empty string array field, throwing REPORT_PARSE_ERROR otherwise. */
function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) throw new Error(REPORT_PARSE_ERROR);
  const items = value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim());
  if (items.length === 0) throw new Error(REPORT_PARSE_ERROR);
  return items;
}

/**
 * Defensively parses the model output into report fields — tolerates prose or
 * markdown fences around the JSON object.
 * @throws Error(REPORT_PARSE_ERROR) when no valid report JSON is found.
 */
export function parseReportJson(raw: string): Pick<GeneratedReport, 'intro' | 'changes' | 'openTopics'> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(REPORT_PARSE_ERROR);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error(REPORT_PARSE_ERROR);
  }
  if (!isRecord(parsed)) throw new Error(REPORT_PARSE_ERROR);
  return {
    intro: readString(parsed, 'intro'),
    changes: readStringArray(parsed, 'changes'),
    openTopics: readStringArray(parsed, 'open_topics'),
  };
}

/** Anthropic Claude prep-report generator (SUMMARY_MODEL, Hebrew prompt, JSON output). */
@Injectable()
export class AnthropicReportGenerator implements ReportGenerator {
  /** Lazily created once — reuses the SDK's keep-alive connection across runs. */
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Generates the prep report from the summaries via the Anthropic API.
   * @throws Error when the key is missing, the call fails, or the output is unparsable.
   */
  async generate(summaries: ReadyMeetingSummary[]): Promise<GeneratedReport> {
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) throw new Error(MISSING_API_KEY_ERROR);
    const model = this.config.get('SUMMARY_MODEL', { infer: true });
    const maxChars = this.config.get('MAX_TRANSCRIPT_CHARS', { infer: true });

    const client = (this.client ??= new Anthropic({ apiKey }));
    const response = await client.messages.create({
      model,
      max_tokens: REPORT_MAX_TOKENS,
      messages: [{ role: 'user', content: buildReportPrompt(summaries, maxChars) }],
    });

    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
    }
    return { ...parseReportJson(text), model };
  }
}
