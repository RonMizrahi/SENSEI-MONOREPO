import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/**
 * Request models for the chat endpoint. The shapes mirror what `@ai-sdk/react`'s
 * `useChat` POSTs: `{ id?, messages: [{ role, parts: [{ type, text?, ... }] }] }`.
 * We read text parts and finished tool parts (a prior `discover_api` / `http_get`
 * call the client re-sends); other part kinds and extra fields are tolerated.
 */

/** Max characters of a single text part — bounds a single forwarded chunk. */
export const MAX_TEXT_CHARS = 8_000;
/** Max parts per message. */
export const MAX_PARTS_PER_MESSAGE = 50;
/** Max messages per conversation. */
export const MAX_MESSAGES = 100;
/** Max characters of the (untrusted) conversation id. */
export const MAX_ID_CHARS = 200;

/** The AI-SDK tool-part state that marks a finished tool call with its output present. */
const TOOL_OUTPUT_STATE = 'output-available';
/** Prefix of a statically-typed tool part's `type` (`tool-<name>`). */
const TOOL_TYPE_PREFIX = 'tool-';
/** `type` of a dynamic tool part (name carried in `toolName`). */
const DYNAMIC_TOOL_TYPE = 'dynamic-tool';
/** `type` of a plain text part. */
const TEXT_TYPE = 'text';

/**
 * One part of a UIMessage. We read text parts and completed tool parts; the rest
 * are ignored. A tool part re-sends an earlier `discover_api` / `http_get` call so
 * the model can reuse it; `state` is `output-available` once the result is in.
 */
export class ChatPartDto {
  @ApiProperty({
    description: 'Part kind — "text", "tool-<name>", or "dynamic-tool".',
    example: 'text',
  })
  @IsString()
  type!: string;

  @ApiPropertyOptional({ description: 'Text content, for text parts.', maxLength: MAX_TEXT_CHARS })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT_CHARS)
  text?: string;

  @ApiPropertyOptional({ description: 'Tool-call id, for tool parts.' })
  @IsOptional()
  @IsString()
  toolCallId?: string;

  @ApiPropertyOptional({ description: 'Tool name, for dynamic-tool parts.' })
  @IsOptional()
  @IsString()
  toolName?: string;

  @ApiPropertyOptional({ description: 'Tool-part lifecycle state (e.g. "output-available").' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Parsed tool-call input (any JSON).' })
  @IsOptional()
  input?: unknown;

  @ApiPropertyOptional({ description: 'Tool-call output (any JSON).' })
  @IsOptional()
  output?: unknown;
}

/** A single UIMessage from the conversation. */
export class ChatMessageDto {
  @ApiProperty({ description: 'Message role — "user" or "assistant".', example: 'user' })
  @IsString()
  role!: string;

  @ApiProperty({ description: 'Ordered message parts.', type: [ChatPartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatPartDto)
  parts: ChatPartDto[] = [];
}

/** The body `useChat` sends to `POST /assistant/chat`. */
export class ChatRequestDto {
  @ApiPropertyOptional({
    description: 'Stable per-conversation id, used only to group tracing.',
    maxLength: MAX_ID_CHARS,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_CHARS)
  id?: string;

  @ApiProperty({ description: 'The full conversation history.', type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[] = [];
}

/**
 * The tool name if this is a tool part, else null.
 * @param part One UIMessage part.
 */
export function toolNameOf(part: ChatPartDto): string | null {
  if (part.type.startsWith(TOOL_TYPE_PREFIX)) return part.type.slice(TOOL_TYPE_PREFIX.length);
  if (part.type === DYNAMIC_TOOL_TYPE) return part.toolName ?? null;
  return null;
}

/**
 * True when this is a tool call that finished (has an id and an output) — the only
 * kind we replay, since OpenAI requires every tool_call id to have a reply.
 * @param part One UIMessage part.
 */
export function isCompletedTool(part: ChatPartDto): boolean {
  return (
    toolNameOf(part) !== null && Boolean(part.toolCallId) && part.state === TOOL_OUTPUT_STATE
  );
}

/**
 * Concatenates a message's text parts into a single content string.
 * @param message One UIMessage.
 */
export function messageText(message: ChatMessageDto): string {
  return message.parts
    .filter((part) => part.type === TEXT_TYPE && part.text)
    .map((part) => part.text)
    .join('');
}

/**
 * The conversation id to group tracing by, or undefined when absent/blank.
 * @param request The chat request body.
 */
export function sessionId(request: ChatRequestDto): string | undefined {
  return (request.id ?? '').trim() || undefined;
}

/**
 * Character length of the most recent user question (0 if there is none).
 * @param request The chat request body.
 */
export function latestQuestionLength(request: ChatRequestDto): number {
  for (let i = request.messages.length - 1; i >= 0; i -= 1) {
    const message = request.messages[i];
    if (message.role === 'user') return messageText(message).length;
  }
  return 0;
}
