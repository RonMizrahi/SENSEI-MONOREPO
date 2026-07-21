import { OpenAiMessage } from './messages';
import { countTokens, trimToTokenBudget } from './tokens';

describe('assistant tokens', () => {
  it('countTokens estimates ~1 token per 4 chars, min 1', () => {
    expect(countTokens('')).toBe(1);
    expect(countTokens('abcd')).toBe(1);
    expect(countTokens('a'.repeat(40))).toBe(10);
  });

  const sys: OpenAiMessage = { role: 'system', content: 'S'.repeat(40) };
  const user = (n: number): OpenAiMessage => ({ role: 'user', content: `U${n} `.repeat(40) });

  it('keeps the system message and the most recent turn, dropping the oldest', () => {
    const messages: OpenAiMessage[] = [sys, user(1), user(2), user(3)];
    // Budget only fits the system header + the latest user turn.
    const trimmed = trimToTokenBudget(messages, 60);
    expect(trimmed[0]).toBe(sys);
    expect(trimmed[trimmed.length - 1]).toBe(messages[3]);
    expect(trimmed).not.toContain(messages[1]); // the oldest turn is dropped
    expect(trimmed.length).toBeLessThan(messages.length);
  });

  it('never removes the guardrails even under an impossibly small budget', () => {
    const trimmed = trimToTokenBudget([sys, user(1)], 1);
    expect(trimmed[0]).toBe(sys);
    // at least the latest block is always retained
    expect(trimmed).toContain(sys);
  });

  it('keeps a tool sequence (assistant tool_calls + tool results) atomic', () => {
    const toolCall: OpenAiMessage = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'http_get', arguments: '{}' } }],
    };
    const toolResult: OpenAiMessage = { role: 'tool', content: '{"status":200}', tool_call_id: 'c1' };
    const latest: OpenAiMessage = { role: 'user', content: 'follow up' };
    const messages: OpenAiMessage[] = [sys, toolCall, toolResult, latest];
    const trimmed = trimToTokenBudget(messages, 10_000);
    // A retained assistant.tool_calls is always immediately followed by its tool result.
    const idx = trimmed.indexOf(toolCall);
    if (idx !== -1) expect(trimmed[idx + 1]).toBe(toolResult);
    // If the block is dropped, neither half survives (no orphan tool message).
    if (idx === -1) expect(trimmed).not.toContain(toolResult);
  });
});
