import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { AnthropicSummarizer } from './anthropic.summarizer';
import { MockSummarizer } from './mock.summarizer';
import { SEED_MOCK_MODEL, SEED_SUMMARY_TEXT } from '../mock/seed';
import { THERAPIST_SUMMARY_SYSTEM_PROMPT } from './summary.prompt';

const createMock = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: createMock } })),
}));

const TEST_MODEL = 'claude-test-model';

function makeConfig(values: Record<string, string | undefined>): ConfigService<Env, true> {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService<Env, true>;
}

describe('AnthropicSummarizer', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('throws a clear error when ANTHROPIC_API_KEY is missing (no API call made)', async () => {
    const summarizer = new AnthropicSummarizer(
      makeConfig({ ANTHROPIC_API_KEY: undefined, SUMMARY_MODEL: TEST_MODEL }),
    );

    await expect(summarizer.summarize('תמליל')).rejects.toThrow(
      'ANTHROPIC_API_KEY is not configured — summary generation is unavailable',
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('sends the verbatim Hebrew system prompt with the transcript as user content', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: ' סיכום מוכן ' }] });
    const summarizer = new AnthropicSummarizer(
      makeConfig({ ANTHROPIC_API_KEY: 'k', SUMMARY_MODEL: TEST_MODEL }),
    );

    const result = await summarizer.summarize('תמליל הפגישה');

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: TEST_MODEL,
        system: THERAPIST_SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'תמליל הפגישה' }],
      }),
    );
    expect(result).toEqual({ text: 'סיכום מוכן', model: TEST_MODEL });
  });

  it('concatenates multiple text blocks and skips non-text blocks', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: 'חלק א' },
        { type: 'tool_use', id: 'x' },
        { type: 'text', text: ' חלק ב' },
      ],
    });
    const summarizer = new AnthropicSummarizer(
      makeConfig({ ANTHROPIC_API_KEY: 'k', SUMMARY_MODEL: TEST_MODEL }),
    );

    await expect(summarizer.summarize('תמליל')).resolves.toEqual({
      text: 'חלק א חלק ב',
      model: TEST_MODEL,
    });
  });

  it('throws when the model returns an empty summary', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: '   ' }] });
    const summarizer = new AnthropicSummarizer(
      makeConfig({ ANTHROPIC_API_KEY: 'k', SUMMARY_MODEL: TEST_MODEL }),
    );

    await expect(summarizer.summarize('תמליל')).rejects.toThrow(
      'the model returned an empty summary',
    );
  });

  it('wraps upstream API failures as "summarization failed: …" (senseiAPI parity)', async () => {
    createMock.mockRejectedValue(new Error('overloaded'));
    const summarizer = new AnthropicSummarizer(
      makeConfig({ ANTHROPIC_API_KEY: 'k', SUMMARY_MODEL: TEST_MODEL }),
    );

    await expect(summarizer.summarize('תמליל')).rejects.toThrow(
      'summarization failed: overloaded',
    );
  });

  it('reuses one SDK client across calls', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'סיכום' }] });
    const summarizer = new AnthropicSummarizer(
      makeConfig({ ANTHROPIC_API_KEY: 'k', SUMMARY_MODEL: TEST_MODEL }),
    );
    const anthropicConstructor = jest.requireMock<{ default: jest.Mock }>(
      '@anthropic-ai/sdk',
    ).default;
    anthropicConstructor.mockClear();

    await summarizer.summarize('תמליל א');
    await summarizer.summarize('תמליל ב');

    expect(anthropicConstructor).toHaveBeenCalledTimes(1);
  });
});

describe('MockSummarizer', () => {
  it('returns the seeded Hebrew summary tagged with the mock model', async () => {
    await expect(new MockSummarizer().summarize()).resolves.toEqual({
      text: SEED_SUMMARY_TEXT,
      model: SEED_MOCK_MODEL,
    });
  });
});
