import {
  ChatMessageDto,
  ChatPartDto,
  ChatRequestDto,
  isCompletedTool,
  messageText,
  toolNameOf,
} from './dto/chat-request.dto';

/**
 * The internal OpenAI message shape we build, trim and stream. Kept as a plain
 * interface (not the SDK's strict union) so token-trimming and tool replay can be
 * expressed simply; the OpenAI client maps it to the SDK's typed params at the
 * request boundary.
 */
export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** One message in the OpenAI Chat Completions conversation. */
export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

/** Roles accepted from the client — "system" is prepended server-side, never trusted from a client. */
const ALLOWED_ROLES = new Set(['user', 'assistant']);

/** The finished tool calls in a message, in order (empty for user turns). */
function completedTools(message: ChatMessageDto): ChatPartDto[] {
  return message.parts.filter((part) => isCompletedTool(part));
}

/**
 * Builds the OpenAI message list: the system prompt followed by the conversation.
 *
 * Assistant turns replay their finished tool calls (`discover_api` / `http_get`) as
 * `assistant.tool_calls` + matching `tool` messages, so the model sees it has already
 * discovered/fetched and does not repeat those calls. Messages with an unsupported
 * role or no usable content are dropped, so a malformed history yields just the system
 * prompt rather than an API error.
 *
 * @param request The client-supplied conversation.
 * @param systemPrompt The trusted, server-side system prompt.
 * @returns The OpenAI-shaped message list.
 */
export function toOpenAiMessages(
  request: ChatRequestDto,
  systemPrompt: string,
): OpenAiMessage[] {
  const messages: OpenAiMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const message of request.messages) {
    if (!ALLOWED_ROLES.has(message.role)) continue;

    if (message.role === 'user') {
      const content = messageText(message);
      if (content) messages.push({ role: 'user', content });
      continue;
    }

    // Assistant turn: emit its tool round(s) first (calls immediately followed by
    // their results, as OpenAI requires), then the final answer text.
    const tools = completedTools(message);
    if (tools.length > 0) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: tools.map((part) => ({
          id: part.toolCallId ?? '',
          type: 'function',
          function: {
            name: toolNameOf(part) ?? '',
            arguments: JSON.stringify(part.input ?? {}),
          },
        })),
      });
      for (const part of tools) {
        messages.push({
          role: 'tool',
          tool_call_id: part.toolCallId ?? '',
          content: JSON.stringify(part.output ?? null),
        });
      }
    }
    const text = messageText(message);
    if (text) messages.push({ role: 'assistant', content: text });
  }
  return messages;
}
