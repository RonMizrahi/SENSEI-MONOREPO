import { StreamEvent } from './assistant-client';
import { MockAssistant } from './mock.assistant';

describe('MockAssistant', () => {
  it('streams a non-empty canned Hebrew reply as text chunks', async () => {
    const events: StreamEvent[] = [];
    for await (const event of new MockAssistant().stream()) events.push(event);

    expect(events.length).toBeGreaterThan(1); // streamed as deltas, not one batch
    expect(events.every((e) => e.kind === 'text')).toBe(true);
    const reply = events.map((e) => (e.kind === 'text' ? e.text : '')).join('');
    expect(reply).toContain('סנסיי');
  });
});
