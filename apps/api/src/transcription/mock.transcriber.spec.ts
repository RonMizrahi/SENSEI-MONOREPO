import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { MOCK_TRANSCRIPT_TEXT, MockTranscriber } from './mock.transcriber';

const makeConfig = (): ConfigService<Env, true> =>
  ({
    get: (key: string) => (key === 'TRANSCRIBE_LANGUAGE' ? 'he' : undefined),
  }) as unknown as ConfigService<Env, true>;

describe('MockTranscriber', () => {
  it('returns the canned Hebrew text in the configured language', async () => {
    const result = await new MockTranscriber(makeConfig()).transcribe();
    expect(result.text).toBe(MOCK_TRANSCRIPT_TEXT);
    expect(result.text).toMatch(/[֐-׿]/);
    expect(result.language).toBe('he');
  });

  it('fabricates monotonically increasing word timings covering every word', async () => {
    const result = await new MockTranscriber(makeConfig()).transcribe();
    expect(result.words).toHaveLength(MOCK_TRANSCRIPT_TEXT.split(' ').length);
    for (const [index, word] of result.words.entries()) {
      expect(word.end).toBeGreaterThan(word.start);
      if (index > 0) expect(word.start).toBeGreaterThanOrEqual(result.words[index - 1].end);
    }
  });

  it('is deterministic across calls', async () => {
    const transcriber = new MockTranscriber(makeConfig());
    await expect(transcriber.transcribe()).resolves.toEqual(await transcriber.transcribe());
  });
});
