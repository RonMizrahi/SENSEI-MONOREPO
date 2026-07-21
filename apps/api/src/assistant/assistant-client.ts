import { OpenAiMessage } from './messages';
import { AssistantTools } from './tools';

/**
 * The assistant model client: the streaming abstraction and its event types.
 *
 * The stream yields typed events — text deltas plus tool-call / tool-result events —
 * so the service can render them as AI-SDK stream parts. Implementations (OpenAI and
 * a MOCK_MODE stand-in) are bound to {@link ASSISTANT_CLIENT}.
 */

/** A streamed fragment of the assistant's answer text. */
export interface TextChunk {
  kind: 'text';
  text: string;
}

/** A tool call the model started, with its parsed arguments. */
export interface ToolCallChunk {
  kind: 'tool-call';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** The result of a completed tool call. */
export interface ToolResultChunk {
  kind: 'tool-result';
  id: string;
  name: string;
  output: unknown;
}

/** One event in an assistant stream. */
export type StreamEvent = TextChunk | ToolCallChunk | ToolResultChunk;

/** DI token bound to the OpenAI client (real mode) or the mock client (MOCK_MODE). */
export const ASSISTANT_CLIENT = Symbol('ASSISTANT_CLIENT');

/** Streams an assistant reply as a sequence of typed events. */
export interface AssistantClient {
  /**
   * Streams the reply for a conversation, optionally running per-request tools.
   * @param messages The OpenAI-shaped conversation.
   * @param tools Optional per-request tool registry (forwarded bearer, scope).
   */
  stream(messages: OpenAiMessage[], tools?: AssistantTools): AsyncIterable<StreamEvent>;
}

/**
 * Raised when the model fails. The message is safe to surface to the client —
 * never put raw upstream SDK error text here (it may contain secrets).
 */
export class AssistantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantError';
  }
}
