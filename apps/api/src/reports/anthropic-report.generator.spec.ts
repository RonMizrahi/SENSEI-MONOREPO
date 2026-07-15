import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import {
  AnthropicReportGenerator,
  buildReportPrompt,
  parseReportJson,
} from './anthropic-report.generator';
import { MISSING_API_KEY_ERROR, REPORT_PARSE_ERROR } from './reports.constants';

jest.mock('@anthropic-ai/sdk', () => {
  const create = jest.fn();
  class MockAnthropic {
    static readonly create = create;
    messages = { create };
  }
  return { __esModule: true, default: MockAnthropic };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sdk = require('@anthropic-ai/sdk') as { default: { create: jest.Mock } };
const messagesCreate = sdk.default.create;

const VALID_REPORT_JSON =
  '{"intro": "מבוא קצר", "changes": ["שינוי אחד", "שינוי שני"], "open_topics": ["נושא פתוח"]}';

function configWith(values: Partial<Record<keyof Env, unknown>>): ConfigService<Env, true> {
  return {
    get: jest.fn((key: keyof Env) => values[key]),
  } as unknown as ConfigService<Env, true>;
}

function textResponse(text: string): { content: { type: string; text: string }[] } {
  return { content: [{ type: 'text', text }] };
}

describe('parseReportJson', () => {
  it('parses a clean JSON object', () => {
    expect(parseReportJson(VALID_REPORT_JSON)).toEqual({
      intro: 'מבוא קצר',
      changes: ['שינוי אחד', 'שינוי שני'],
      openTopics: ['נושא פתוח'],
    });
  });

  it('tolerates markdown fences and surrounding prose', () => {
    const wrapped = 'הנה הדוח:\n```json\n' + VALID_REPORT_JSON + '\n```\nבהצלחה!';
    expect(parseReportJson(wrapped).intro).toBe('מבוא קצר');
  });

  it('trims values and drops non-string array items', () => {
    const messy = '{"intro": " מבוא ", "changes": [" שינוי ", 5, ""], "open_topics": ["נושא"]}';
    expect(parseReportJson(messy)).toEqual({
      intro: 'מבוא',
      changes: ['שינוי'],
      openTopics: ['נושא'],
    });
  });

  it.each([
    ['no JSON at all', 'סתם טקסט חופשי'],
    ['broken JSON', '{"intro": "x", '],
    ['a JSON array', '[1, 2, 3]'],
    ['missing intro', '{"changes": ["x"], "open_topics": ["y"]}'],
    ['empty intro', '{"intro": " ", "changes": ["x"], "open_topics": ["y"]}'],
    ['non-array changes', '{"intro": "x", "changes": "y", "open_topics": ["z"]}'],
    ['empty open_topics', '{"intro": "x", "changes": ["y"], "open_topics": []}'],
  ])('throws the parse error on %s', (_name, raw) => {
    expect(() => parseReportJson(raw)).toThrow(REPORT_PARSE_ERROR);
  });
});

describe('buildReportPrompt', () => {
  it('numbers the summaries oldest-first and asks for the JSON contract', () => {
    const prompt = buildReportPrompt(
      [
        { meetingId: 'a', text: 'סיכום ראשון' },
        { meetingId: 'b', text: 'סיכום שני' },
      ],
      10_000,
    );
    expect(prompt).toContain('[פגישה 1]\nסיכום ראשון');
    expect(prompt).toContain('[פגישה 2]\nסיכום שני');
    expect(prompt).toContain('"intro"');
    expect(prompt).toContain('"open_topics"');
  });

  it('truncates a single oversized summary to the cap', () => {
    const cap = 50;
    const prompt = buildReportPrompt([{ meetingId: 'a', text: 'א'.repeat(500) }], cap);
    // block = '[פגישה 1]\n' (10 chars) + 40 'א' after the cap
    expect(prompt).toContain('א'.repeat(40));
    expect(prompt).not.toContain('א'.repeat(41));
  });

  it('drops the oldest summaries first when over the cap (recency wins)', () => {
    const newestText = 'הסיכום החדש ביותר';
    const prompt = buildReportPrompt(
      [
        { meetingId: 'old', text: 'י'.repeat(300) },
        { meetingId: 'new', text: newestText },
      ],
      60,
    );
    expect(prompt).toContain(newestText);
    expect(prompt).not.toContain('י'.repeat(100));
  });
});

describe('AnthropicReportGenerator', () => {
  beforeEach(() => messagesCreate.mockReset());

  it('rejects with a clear error when ANTHROPIC_API_KEY is missing', async () => {
    const generator = new AnthropicReportGenerator(
      configWith({ SUMMARY_MODEL: 'claude-test', MAX_TRANSCRIPT_CHARS: 1000 }),
    );
    await expect(generator.generate([{ meetingId: 'm', text: 'סיכום' }])).rejects.toThrow(
      MISSING_API_KEY_ERROR,
    );
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it('calls the configured model and returns the parsed report + model', async () => {
    messagesCreate.mockResolvedValue(textResponse('```json\n' + VALID_REPORT_JSON + '\n```'));
    const generator = new AnthropicReportGenerator(
      configWith({ ANTHROPIC_API_KEY: 'key', SUMMARY_MODEL: 'claude-test', MAX_TRANSCRIPT_CHARS: 1000 }),
    );
    const report = await generator.generate([{ meetingId: 'm', text: 'סיכום פגישה' }]);
    expect(report).toEqual({
      intro: 'מבוא קצר',
      changes: ['שינוי אחד', 'שינוי שני'],
      openTopics: ['נושא פתוח'],
      model: 'claude-test',
    });
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-test',
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('סיכום פגישה') as string,
          }),
        ],
      }),
    );
  });

  it('rejects with the parse error when the model returns garbage', async () => {
    messagesCreate.mockResolvedValue(textResponse('אני לא JSON'));
    const generator = new AnthropicReportGenerator(
      configWith({ ANTHROPIC_API_KEY: 'key', SUMMARY_MODEL: 'claude-test', MAX_TRANSCRIPT_CHARS: 1000 }),
    );
    await expect(generator.generate([{ meetingId: 'm', text: 'סיכום' }])).rejects.toThrow(
      REPORT_PARSE_ERROR,
    );
  });

  it('propagates upstream API failures', async () => {
    messagesCreate.mockRejectedValue(new Error('overloaded'));
    const generator = new AnthropicReportGenerator(
      configWith({ ANTHROPIC_API_KEY: 'key', SUMMARY_MODEL: 'claude-test', MAX_TRANSCRIPT_CHARS: 1000 }),
    );
    await expect(generator.generate([{ meetingId: 'm', text: 'סיכום' }])).rejects.toThrow(
      'overloaded',
    );
  });
});
