import { OpenAiMessage } from './messages';

/**
 * Token counting + history trimming, to keep the prompt under a token ceiling.
 *
 * Uses a rough character estimate (~4 chars/token) so it stays hermetic — no
 * tokenizer download or extra dependency. The counter is injectable so tests can
 * pin an exact count.
 */

/** Small fixed overhead per chat message (role/formatting), matching OpenAI's guidance. */
const PER_MESSAGE_TOKENS = 4;

/** Characters-per-token used by the fallback estimator. */
const CHARS_PER_TOKEN = 4;

/** A function that estimates the token count of a string. */
export type TokenCounter = (text: string) => number;

/**
 * Rough token estimate (~4 chars/token), never below 1 for non-empty text.
 * @param text The string to estimate.
 * @returns Estimated token count.
 */
export function countTokens(text: string): number {
  return Math.max(1, Math.floor(text.length / CHARS_PER_TOKEN));
}

/**
 * Estimated tokens for one message, including any tool-call payload.
 * @param message The message to size.
 * @param count The token counter.
 */
function messageTokens(message: OpenAiMessage, count: TokenCounter): number {
  let total = count(typeof message.content === 'string' ? message.content : '');
  for (const call of message.tool_calls ?? []) {
    total += count(call.function.name) + count(call.function.arguments);
  }
  return total + PER_MESSAGE_TOKENS;
}

/**
 * Groups the conversation into atomic blocks, keeping each `assistant` message's
 * `tool_calls` together with the `tool` result messages that immediately follow it.
 * Trimming operates on whole blocks so it can never split a tool sequence.
 * @param tail The messages after the leading system message.
 */
function toolSequenceBlocks(tail: OpenAiMessage[]): OpenAiMessage[][] {
  const blocks: OpenAiMessage[][] = [];
  let i = 0;
  while (i < tail.length) {
    const message = tail[i];
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      let j = i + 1;
      while (j < tail.length && tail[j].role === 'tool') j += 1;
      blocks.push(tail.slice(i, j));
      i = j;
    } else {
      blocks.push([message]);
      i += 1;
    }
  }
  return blocks;
}

/**
 * Drops the oldest messages until the prompt fits `maxTokens`.
 *
 * The leading system message and the most recent turn are always kept, so trimming
 * never removes the guardrails or the live turn. Tool sequences (an `assistant`
 * `tool_calls` message plus its `tool` results) are kept or dropped as one unit.
 *
 * @param messages The full message list.
 * @param maxTokens The token budget.
 * @param count Optional token counter (defaults to the char estimator).
 * @returns The trimmed message list — always a valid OpenAI message list.
 */
export function trimToTokenBudget(
  messages: OpenAiMessage[],
  maxTokens: number,
  count: TokenCounter = countTokens,
): OpenAiMessage[] {
  if (messages.length === 0) return messages;

  const head = messages[0].role === 'system' ? messages.slice(0, 1) : [];
  const tail = messages.slice(head.length);

  let budget = maxTokens - head.reduce((sum, m) => sum + messageTokens(m, count), 0);
  const keptBlocks: OpenAiMessage[][] = [];
  const blocks = toolSequenceBlocks(tail);
  for (let b = blocks.length - 1; b >= 0; b -= 1) {
    const block = blocks[b];
    const cost = block.reduce((sum, m) => sum + messageTokens(m, count), 0);
    if (keptBlocks.length > 0 && cost > budget) break; // keep at least the latest block
    budget -= cost;
    keptBlocks.push(block);
  }
  keptBlocks.reverse();
  return [...head, ...keptBlocks.flat()];
}
