import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Env } from '../config/env.schema';
import {
  AssistantClient,
  AssistantError,
  StreamEvent,
} from './assistant-client';
import { OpenAiMessage } from './messages';
import { AssistantTools, ToolSpec } from './tools';

/**
 * Assistant backed by the hosted OpenAI Chat Completions API, with a tool-call loop.
 *
 * Ported from senseiAPI's `assistant/client.py`: streams text as it arrives, offers
 * tools on every round except the last, dispatches tool calls back into the PHI-safe
 * context surface, and never leaks the underlying SDK error to the client.
 */

/**
 * Cap tool rounds so a misbehaving model can't loop forever. The longest legitimate
 * chain is discover → patients → meetings → summary (4), plus headroom.
 */
const MAX_TOOL_ROUNDS = 6;

/** Shown to the client when the model fails — deliberately generic (never SDK text). */
const UNAVAILABLE_MESSAGE = 'העוזר אינו זמין כרגע. נסו שוב מאוחר יותר.';

/** Appended when the model hit the output-token cap, so the reader knows it was clipped. */
const CLIP_MESSAGE = '\n\n(התשובה קוצרה עקב מגבלת האורך.)';

/** Accumulator for a streamed tool call assembled across chunks. */
interface ToolCallAccumulator {
  id: string;
  name: string;
  args: string;
}

@Injectable()
export class OpenAIAssistant implements AssistantClient {
  private readonly logger = new Logger(OpenAIAssistant.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Streams the assistant reply, running the OpenAI tool-call loop.
   * @param messages The OpenAI-shaped conversation.
   * @param tools Optional per-request tool registry.
   * @throws AssistantError when the model is unavailable or the loop overruns.
   */
  async *stream(messages: OpenAiMessage[], tools?: AssistantTools): AsyncIterable<StreamEvent> {
    const client = this.getClient();
    const model = this.config.get('OPENAI_MODEL', { infer: true });
    const maxOutputTokens = this.config.get('ASSISTANT_MAX_OUTPUT_TOKENS', { infer: true });
    const specs: ToolSpec[] = tools ? tools.specs() : [];
    const convo: OpenAiMessage[] = [...messages];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
        model,
        messages: this.toSdkMessages(convo),
        stream: true,
      };
      // Offer tools on every round except the last: on the final round we drop them so
      // the model MUST answer from what it fetched, instead of starting a call it has
      // no round left to finish.
      if (specs.length > 0 && round < MAX_TOOL_ROUNDS) params.tools = specs;
      if (maxOutputTokens) params.max_completion_tokens = maxOutputTokens;

      const toolCalls = new Map<number, ToolCallAccumulator>();
      let finishReason: string | null = null;

      try {
        const completion = await client.chat.completions.create(params);
        for await (const chunk of completion) {
          const choice = chunk.choices[0];
          if (!choice) continue;
          if (choice.delta.content) yield { kind: 'text', text: choice.delta.content };
          for (const call of choice.delta.tool_calls ?? []) {
            const acc = toolCalls.get(call.index) ?? { id: '', name: '', args: '' };
            if (call.id) acc.id = call.id;
            if (call.function?.name) acc.name += call.function.name;
            if (call.function?.arguments) acc.args += call.function.arguments;
            toolCalls.set(call.index, acc);
          }
          if (choice.finish_reason) finishReason = choice.finish_reason;
        }
      } catch (exc) {
        this.logger.error('openai assistant request/stream failed', exc);
        throw new AssistantError(UNAVAILABLE_MESSAGE);
      }

      if (finishReason !== 'tool_calls' || toolCalls.size === 0) {
        // Final answer already streamed. If it hit the output-token cap, say so.
        if (finishReason === 'length') yield { kind: 'text', text: CLIP_MESSAGE };
        return;
      }

      const ordered = [...toolCalls.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, call]) => call);
      convo.push({
        role: 'assistant',
        content: null,
        tool_calls: ordered.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.args || '{}' },
        })),
      });
      for (const call of ordered) {
        const args = this.parseArgs(call.args);
        yield { kind: 'tool-call', id: call.id, name: call.name, arguments: args };
        const result = await this.runTool(tools, call.name, args);
        yield { kind: 'tool-result', id: call.id, name: call.name, output: result };
        convo.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    throw new AssistantError(UNAVAILABLE_MESSAGE); // ran out of tool rounds
  }

  /** Lazily constructs the OpenAI client from OPENAI_API_KEY. */
  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = this.config.get('OPENAI_API_KEY', { infer: true });
    if (!apiKey) throw new AssistantError(UNAVAILABLE_MESSAGE);
    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  /** Parses accumulated tool-call arguments, tolerating malformed JSON. */
  private parseArgs(raw: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw || '{}');
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return { ...parsed };
      }
      return {};
    } catch {
      return {};
    }
  }

  /** Dispatches one tool call; a tool failure is fed back to the model, not fatal. */
  private async runTool(
    tools: AssistantTools | undefined,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!tools) return { error: 'tool not available' };
    try {
      return await tools.dispatch(name, args);
    } catch (exc) {
      this.logger.error(`assistant tool ${name} failed`, exc);
      return { error: 'tool call failed' };
    }
  }

  /** Maps our internal message shape to the OpenAI SDK's typed message params. */
  private toSdkMessages(
    messages: OpenAiMessage[],
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map((message) => {
      switch (message.role) {
        case 'system':
          return { role: 'system', content: message.content ?? '' };
        case 'user':
          return { role: 'user', content: message.content ?? '' };
        case 'tool':
          return {
            role: 'tool',
            content: message.content ?? '',
            tool_call_id: message.tool_call_id ?? '',
          };
        case 'assistant':
          return message.tool_calls && message.tool_calls.length > 0
            ? { role: 'assistant', content: message.content, tool_calls: message.tool_calls }
            : { role: 'assistant', content: message.content ?? '' };
      }
    });
  }
}
