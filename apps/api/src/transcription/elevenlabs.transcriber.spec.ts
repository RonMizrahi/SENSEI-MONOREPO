import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { ELEVENLABS_STT_URL, ElevenLabsTranscriber } from './elevenlabs.transcriber';

type EnvValues = Partial<Record<keyof Env, unknown>>;

const makeConfig = (values: EnvValues): ConfigService<Env, true> =>
  ({ get: (key: keyof Env) => values[key] }) as unknown as ConfigService<Env, true>;

const ENV: EnvValues = {
  ELEVENLABS_API_KEY: 'test-key',
  ELEVENLABS_MODEL: 'scribe_v2',
  TRANSCRIBE_LANGUAGE: 'he',
};

const SCRIBE_RESPONSE = {
  language_code: 'heb',
  text: 'שלום עולם',
  words: [
    { text: 'שלום', type: 'word', start: 0, end: 0.5 },
    { text: ' ', type: 'spacing', start: 0.5, end: 0.6 },
    { text: 'עולם', type: 'word', start: 0.6, end: 1.1 },
    { text: '(רעש)', type: 'audio_event', start: 1.1, end: 1.5 },
  ],
};

describe('ElevenLabsTranscriber', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(SCRIBE_RESPONSE), { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('parses text and keeps only word-typed entries', async () => {
    const transcriber = new ElevenLabsTranscriber(makeConfig(ENV));
    const result = await transcriber.transcribe(Buffer.from('audio'), 'a.mp3');
    expect(result.text).toBe('שלום עולם');
    expect(result.words).toEqual([
      { text: 'שלום', start: 0, end: 0.5 },
      { text: 'עולם', start: 0.6, end: 1.1 },
    ]);
  });

  it('reports the configured language, not the ISO-639-3 answer', async () => {
    const transcriber = new ElevenLabsTranscriber(makeConfig(ENV));
    const result = await transcriber.transcribe(Buffer.from('audio'), 'a.mp3');
    expect(result.language).toBe('he');
  });

  it('sends a multipart request with the model, language, and key', async () => {
    const transcriber = new ElevenLabsTranscriber(makeConfig(ENV));
    await transcriber.transcribe(Buffer.from('audio'), 'a.mp3');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ELEVENLABS_STT_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'xi-api-key': 'test-key' });
    const form = init.body as FormData;
    expect(form.get('model_id')).toBe('scribe_v2');
    expect(form.get('language_code')).toBe('he');
    expect(form.get('timestamps_granularity')).toBe('word');
    const file = form.get('file');
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('a.mp3');
  });

  it('tolerates a response without words', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ text: 'טקסט' }), { status: 200 }));
    const transcriber = new ElevenLabsTranscriber(makeConfig(ENV));
    await expect(transcriber.transcribe(Buffer.from('audio'), 'a.mp3')).resolves.toEqual({
      text: 'טקסט',
      language: 'he',
      words: [],
    });
  });

  it('throws a clear error when the API key is missing', async () => {
    const transcriber = new ElevenLabsTranscriber(
      makeConfig({ ...ENV, ELEVENLABS_API_KEY: undefined }),
    );
    await expect(transcriber.transcribe(Buffer.from('audio'), 'a.mp3')).rejects.toThrow(
      /ELEVENLABS_API_KEY/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws on a non-2xx response with the status in the message', async () => {
    fetchSpy.mockResolvedValue(new Response('quota exceeded', { status: 429 }));
    const transcriber = new ElevenLabsTranscriber(makeConfig(ENV));
    await expect(transcriber.transcribe(Buffer.from('audio'), 'a.mp3')).rejects.toThrow(/429/);
  });

  it('throws when the response body does not match the expected shape', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 200 }));
    const transcriber = new ElevenLabsTranscriber(makeConfig(ENV));
    await expect(transcriber.transcribe(Buffer.from('audio'), 'a.mp3')).rejects.toThrow();
  });

  it('propagates network failures', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const transcriber = new ElevenLabsTranscriber(makeConfig(ENV));
    await expect(transcriber.transcribe(Buffer.from('audio'), 'a.mp3')).rejects.toThrow(
      'network down',
    );
  });
});
