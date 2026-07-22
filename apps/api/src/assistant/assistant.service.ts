import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { ASSISTANT_CLIENT, AssistantError } from './assistant-client';
import type { AssistantClient } from './assistant-client';
import { ChatRequestDto } from './dto/chat-request.dto';
import { toOpenAiMessages } from './messages';
import { ASSISTANT_SYSTEM_PROMPT } from './prompt';
import { trimToTokenBudget } from './tokens';
import { AssistantTools, FetchOptions } from './tools';
import { buildTracer, Tracer } from './tracing';
import * as sse from './sse';

/** Per-request context needed to stream a reply. */
export interface StreamContext {
  userId?: string;
  sessionId?: string;
  authHeader?: string;
}

/** Timeout for one tool-driven self-request (ms). */
const TOOL_FETCH_TIMEOUT_MS = 10_000;

/**
 * Performs one GET for the assistant's tools using Node's global fetch (GET-only,
 * 10s timeout). Returns [status, parsedJson | rawText].
 * @param url The absolute URL to GET.
 * @param opts Headers and optional query params.
 */
async function fetchGet(url: string, opts: FetchOptions): Promise<[number, unknown]> {
  const query = opts.params ? new URLSearchParams(opts.params).toString() : '';
  const target = query ? `${url}?${query}` : url;
  const response = await fetch(target, {
    method: 'GET',
    headers: opts.headers,
    signal: AbortSignal.timeout(TOOL_FETCH_TIMEOUT_MS),
  });
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    return [response.status, parsed];
  } catch {
    return [response.status, text];
  }
}

/**
 * Turns a {@link ChatRequestDto} into a stream of AI-SDK UI Message Stream frames.
 * Stateless: the frontend sends the full conversation each request.
 */
@Injectable()
export class AssistantService {
  private readonly tracer: Tracer;

  constructor(
    @Inject(ASSISTANT_CLIENT) private readonly client: AssistantClient,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.tracer = buildTracer(config);
  }

  /**
   * Rejects the request early when the assistant is unavailable.
   * @throws ServiceUnavailableException when disabled or missing an OpenAI key.
   */
  ensureAvailable(): void {
    if (this.config.get('MOCK_MODE', { infer: true })) return;
    if (!this.config.get('ASSISTANT_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException('the assistant is disabled');
    }
    if (!this.config.get('OPENAI_API_KEY', { infer: true })) {
      throw new ServiceUnavailableException(
        'the assistant is not configured (missing OPENAI_API_KEY)',
      );
    }
  }

  /**
   * Streams the assistant reply as SSE frames (start → text → finish → [DONE]).
   * @param request The client-supplied conversation.
   * @param context Therapist user id, conversation session id, and forwarded bearer.
   * @returns An async iterable of SSE `data:` frames.
   */
  async *streamSse(request: ChatRequestDto, context: StreamContext): AsyncIterable<string> {
    let messages = toOpenAiMessages(request, ASSISTANT_SYSTEM_PROMPT);
    const maxInputTokens = this.config.get('ASSISTANT_MAX_TOTAL_INPUT_TOKENS', { infer: true });
    if (maxInputTokens) messages = trimToTokenBudget(messages, maxInputTokens);

    const tools = new AssistantTools({
      baseUrl: this.config.get('ASSISTANT_SELF_BASE_URL', { infer: true }),
      fetch: fetchGet,
      authHeader: context.authHeader,
      allowAllGets: this.config.get('ASSISTANT_ALLOW_ALL_GETS', { infer: true }),
    });

    const trace = this.tracer.traceChat({
      userId: context.userId,
      sessionId: context.sessionId,
    });

    yield sse.start();
    let textStarted = false;
    const reply: string[] = [];
    try {
      for await (const event of this.client.stream(messages, tools)) {
        if (event.kind === 'tool-call') {
          yield sse.toolInputAvailable(event.id, event.name, event.arguments);
        } else if (event.kind === 'tool-result') {
          yield sse.toolOutputAvailable(event.id, event.output);
        } else {
          if (!textStarted) {
            yield sse.textStart();
            textStarted = true;
          }
          reply.push(event.text);
          yield sse.textDelta(event.text);
        }
      }
    } catch (exc) {
      if (exc instanceof AssistantError) {
        // A mid-stream failure becomes an error part the client renders, never a
        // broken HTTP response (the 200 stream has already begun).
        trace.setError(exc.message);
        yield sse.error(exc.message);
        yield sse.DONE;
        return;
      }
      throw exc;
    }

    trace.setOutput(reply.join(''));
    if (textStarted) yield sse.textEnd();
    yield sse.finish();
    yield sse.DONE;
  }
}
