import {
  DONE,
  error,
  finish,
  start,
  TEXT_ID,
  textDelta,
  textEnd,
  textStart,
  toolInputAvailable,
  toolOutputAvailable,
  UI_MESSAGE_STREAM_HEADER,
  UI_MESSAGE_STREAM_VERSION,
} from './sse';

/**
 * The exact AI-SDK "UI Message Stream" wire format. The web transport
 * (@ai-sdk/react useChat) rejects the stream on any deviation, so these assert
 * byte-for-byte frames — compact JSON, no spaces, non-ASCII (Hebrew) unescaped.
 */
describe('assistant sse frames', () => {
  it('exposes the transport header contract', () => {
    expect(UI_MESSAGE_STREAM_HEADER).toBe('x-vercel-ai-ui-message-stream');
    expect(UI_MESSAGE_STREAM_VERSION).toBe('v1');
    expect(DONE).toBe('data: [DONE]\n\n');
    expect(TEXT_ID).toBe('0');
  });

  it('frames the minimal text sequence exactly', () => {
    expect(start()).toBe('data: {"type":"start"}\n\n');
    expect(textStart()).toBe('data: {"type":"text-start","id":"0"}\n\n');
    expect(textDelta('שלום')).toBe('data: {"type":"text-delta","id":"0","delta":"שלום"}\n\n');
    expect(textEnd()).toBe('data: {"type":"text-end","id":"0"}\n\n');
    expect(finish()).toBe('data: {"type":"finish"}\n\n');
  });

  it('keeps Hebrew unescaped and JSON compact (no spaces)', () => {
    const frame = textDelta('מי הבא בתור?');
    expect(frame).toContain('מי הבא בתור?');
    expect(frame).not.toMatch(/\\u05/); // no \uXXXX escaping
    // The JSON body (between "data: " and the trailing blank line) is compact —
    // no pretty-print spaces after ':' or ','.
    const json = frame.slice('data: '.length, -2);
    expect(json).toBe('{"type":"text-delta","id":"0","delta":"מי הבא בתור?"}');
  });

  it('frames tool input/output with camelCase keys', () => {
    expect(toolInputAvailable('call_1', 'http_get', { path: '/assistant/context/patients' })).toBe(
      'data: {"type":"tool-input-available","toolCallId":"call_1","toolName":"http_get","input":{"path":"/assistant/context/patients"}}\n\n',
    );
    expect(toolOutputAvailable('call_1', { status: 200 })).toBe(
      'data: {"type":"tool-output-available","toolCallId":"call_1","output":{"status":200}}\n\n',
    );
  });

  it('frames an error part with errorText', () => {
    expect(error('נכשל')).toBe('data: {"type":"error","errorText":"נכשל"}\n\n');
  });
});
