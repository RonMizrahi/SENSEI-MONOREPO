/**
 * Formatters for the Vercel AI SDK "UI Message Stream" SSE protocol.
 *
 * The frontend consumes this endpoint with `@ai-sdk/react`'s `useChat`, which
 * expects Server-Sent Events framed as the AI SDK UI Message Stream (protocol v1).
 * Each event is a line `data: {json}\n\n`; the stream ends with `data: [DONE]`.
 *
 * A minimal text response is the sequence:
 *   start -> text-start -> text-delta* -> text-end -> finish -> [DONE]
 *
 * These helpers are pure string builders so the exact wire format can be unit-tested
 * without a running model. See https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol.
 */

/** The header value the frontend transport requires to accept the stream. */
export const UI_MESSAGE_STREAM_HEADER = 'x-vercel-ai-ui-message-stream';
export const UI_MESSAGE_STREAM_VERSION = 'v1';

/** Single text block per response; the id only has to be stable within the stream. */
export const TEXT_ID = '0';

/** Terminal sentinel that closes a UI Message Stream. */
export const DONE = 'data: [DONE]\n\n';

/** One stream part; encoded compactly, exactly as the SDK emits it. */
interface StreamPart {
  type: string;
  [key: string]: unknown;
}

/**
 * Encodes one stream part as an SSE `data:` event (compact JSON, as the SDK emits).
 * @param part The stream part object to serialize.
 * @returns The framed `data: {json}\n\n` string.
 */
function frame(part: StreamPart): string {
  return `data: ${JSON.stringify(part)}\n\n`;
}

/** The stream-start frame. */
export function start(): string {
  return frame({ type: 'start' });
}

/** Opens the single text block. */
export function textStart(): string {
  return frame({ type: 'text-start', id: TEXT_ID });
}

/**
 * One text delta appended to the open text block.
 * @param delta The text fragment produced by the model.
 */
export function textDelta(delta: string): string {
  return frame({ type: 'text-delta', id: TEXT_ID, delta });
}

/** Closes the single text block. */
export function textEnd(): string {
  return frame({ type: 'text-end', id: TEXT_ID });
}

/**
 * A tool call the model started, with its parsed input.
 * @param toolCallId Unique id of the tool call.
 * @param toolName Name of the invoked tool.
 * @param input Parsed arguments passed to the tool.
 */
export function toolInputAvailable(toolCallId: string, toolName: string, input: unknown): string {
  return frame({ type: 'tool-input-available', toolCallId, toolName, input });
}

/**
 * The result of a completed tool call.
 * @param toolCallId Unique id of the tool call this output belongs to.
 * @param output The tool's return value.
 */
export function toolOutputAvailable(toolCallId: string, output: unknown): string {
  return frame({ type: 'tool-output-available', toolCallId, output });
}

/** The stream-finish frame. */
export function finish(): string {
  return frame({ type: 'finish' });
}

/**
 * A mid-stream error part the client renders in place of more text.
 * @param message Human-readable, client-safe error text.
 */
export function error(message: string): string {
  return frame({ type: 'error', errorText: message });
}
