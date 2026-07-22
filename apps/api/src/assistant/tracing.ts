import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Langfuse, LangfuseTraceClient } from 'langfuse';
import type { Env } from '../config/env.schema';

/**
 * Optional Langfuse tracing for the assistant, behind a langfuse-agnostic seam.
 *
 * The service depends on the {@link Tracer} interface, not on Langfuse. The default
 * {@link NoOpTracer} adds nothing when tracing is off. When enabled, one chat request
 * becomes one Langfuse trace named `assistant-chat`, tagged with the therapist user id
 * and the conversation session id. All tracing calls swallow errors — recording runs
 * mid-stream and must never break the streamed reply.
 */

const logger = new Logger('AssistantTracing');
const TRACE_NAME = 'assistant-chat';

/** Identifiers used to group a trace. */
export interface TraceContext {
  userId?: string;
  sessionId?: string;
}

/**
 * A live handle to the current chat trace: record its final output or an error.
 * Both methods run mid-stream and must never raise.
 */
export interface ChatTrace {
  setOutput(text: string): void;
  setError(message: string): void;
}

/** Opens a trace spanning one chat request. Model generations nest under it. */
export interface Tracer {
  traceChat(context: TraceContext): ChatTrace;
}

/** The default no-op trace handle. */
class NoOpChatTrace implements ChatTrace {
  setOutput(): void {
    /* no-op */
  }

  setError(): void {
    /* no-op */
  }
}

/** The default tracer: does nothing, so the assistant behaves exactly as before. */
export class NoOpTracer implements Tracer {
  /** Returns a no-op trace handle. */
  traceChat(): ChatTrace {
    return new NoOpChatTrace();
  }
}

/** Langfuse-backed trace handle — recording is best-effort and never throws. */
class LangfuseChatTrace implements ChatTrace {
  constructor(private readonly trace: LangfuseTraceClient) {}

  /** Records the final assistant output on the trace. */
  setOutput(text: string): void {
    try {
      this.trace.update({ output: text });
    } catch {
      logger.warn('langfuse setOutput failed');
    }
  }

  /** Records an error outcome on the trace. */
  setError(message: string): void {
    try {
      this.trace.update({ output: message, tags: ['error'], metadata: { error: message } });
    } catch {
      logger.warn('langfuse setError failed');
    }
  }
}

/** Traces each chat request with Langfuse, grouping the model rounds under it. */
export class LangfuseTracer implements Tracer {
  constructor(private readonly client: Langfuse) {}

  /**
   * Opens a Langfuse trace for one chat request; degrades to a no-op on any failure.
   * @param context The therapist user id and conversation session id.
   */
  traceChat(context: TraceContext): ChatTrace {
    try {
      const trace = this.client.trace({
        name: TRACE_NAME,
        userId: context.userId,
        sessionId: context.sessionId,
        tags: ['assistant'],
      });
      return new LangfuseChatTrace(trace);
    } catch {
      logger.warn('langfuse trace setup failed; continuing untraced');
      return new NoOpChatTrace();
    }
  }
}

/**
 * A {@link LangfuseTracer} when tracing is enabled and keyed, else a no-op.
 * @param config The validated environment configuration.
 */
export function buildTracer(config: ConfigService<Env, true>): Tracer {
  const enabled = config.get('LANGFUSE_ENABLED', { infer: true });
  const publicKey = config.get('LANGFUSE_PUBLIC_KEY', { infer: true });
  const secretKey = config.get('LANGFUSE_SECRET_KEY', { infer: true });
  if (!enabled || !publicKey || !secretKey) return new NoOpTracer();
  try {
    const baseUrl = config.get('LANGFUSE_BASE_URL', { infer: true });
    // Loaded lazily so a deployment with tracing disabled never imports the SDK
    // (mirrors senseiAPI) — its internal dynamic import also breaks Jest's
    // CommonJS runner if pulled in at module load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Langfuse } = require('langfuse') as typeof import('langfuse');
    return new LangfuseTracer(new Langfuse({ publicKey, secretKey, baseUrl }));
  } catch {
    logger.warn('langfuse client construction failed; tracing disabled');
    return new NoOpTracer();
  }
}
