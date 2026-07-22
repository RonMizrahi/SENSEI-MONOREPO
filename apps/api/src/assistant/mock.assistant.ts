import { Injectable } from '@nestjs/common';
import { AssistantClient, StreamEvent } from './assistant-client';

/**
 * MOCK_MODE assistant — ignores tools and yields a few canned Hebrew text chunks so
 * the web AI panel streams a valid reply when the API runs without an OpenAI key.
 */

/** Canned Hebrew reply, split into chunks so the client sees streamed deltas. */
const MOCK_REPLY_CHUNKS = [
  'שלום! ',
  'אני סנסיי, ',
  'עוזר התיעוד והארגון שלכם. ',
  'במצב הדגמה איני מחובר/ת למודל אמיתי, ',
  'אך אשמח לסייע בניסוח, סיכום וארגון עבודת הקליניקה.',
];

@Injectable()
export class MockAssistant implements AssistantClient {
  /**
   * Streams the canned reply as text chunks, ignoring any tools.
   * @returns An async iterable of text events.
   */
  async *stream(): AsyncIterable<StreamEvent> {
    for (const text of MOCK_REPLY_CHUNKS) {
      await Promise.resolve(); // yield to the event loop so deltas stream, not batch
      yield { kind: 'text', text };
    }
  }
}
