// Live mode: when a backend is configured, the assistant streams answers from
// /assistant/chat via useChat. We mock fetch to emit the Vercel AI-SDK UI message
// stream (the exact frames the FastAPI backend produces) and assert they render.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

// Force "backend configured" while keeping the rest of apiClient intact.
vi.mock('../src/services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/apiClient')>();
  return { ...actual, isApiConfigured: () => true, API_BASE_URL: 'http://localhost:8000' };
});

import { AppStoreProvider } from '../src/store/AppStore';
import AiAssistant from '../src/components/layout/AiAssistant';

const FRAMES = [
  'data: {"type":"start"}\n\n',
  'data: {"type":"text-start","id":"0"}\n\n',
  'data: {"type":"text-delta","id":"0","delta":"שלום"}\n\n',
  'data: {"type":"text-delta","id":"0","delta":" עולם"}\n\n',
  'data: {"type":"text-end","id":"0"}\n\n',
  'data: {"type":"finish"}\n\n',
  'data: [DONE]\n\n',
];

function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => sseResponse(FRAMES));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('AiAssistant — live mode (backend configured)', () => {
  it('streams the assistant reply from the backend into the panel', async () => {
    render(
      <AppStoreProvider>
        <AiAssistant />
      </AppStoreProvider>,
    );

    fireEvent.click(document.querySelector('[aria-label="שאל את סנסיי"]') as HTMLElement);
    const input = document.querySelector('[aria-label="הקלדת שאלה"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'שאלה' } });
    fireEvent.click(document.querySelector('[aria-label="שליחה"]') as HTMLElement);

    // The streamed deltas render as one assistant bubble.
    await waitFor(() => expect(document.body.textContent).toContain('שלום עולם'), { timeout: 3000 });

    // It called the configured endpoint.
    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('http://localhost:8000/assistant/chat');
  });

  it('renders a tool call as a collapsed line that expands to the full interaction', async () => {
    const toolFrames = [
      'data: {"type":"start"}\n\n',
      'data: {"type":"tool-input-available","toolCallId":"c1","toolName":"http_get","input":{"path":"/assistant/context/agenda"}}\n\n',
      'data: {"type":"tool-output-available","toolCallId":"c1","output":{"status":200,"body":[{"patient_name":"דנה"}]}}\n\n',
      'data: {"type":"text-start","id":"0"}\n\n',
      'data: {"type":"text-delta","id":"0","delta":"הפגישה עם דנה"}\n\n',
      'data: {"type":"text-end","id":"0"}\n\n',
      'data: {"type":"finish"}\n\n',
      'data: [DONE]\n\n',
    ];
    fetchMock.mockImplementation(async () => sseResponse(toolFrames));

    render(
      <AppStoreProvider>
        <AiAssistant />
      </AppStoreProvider>,
    );
    fireEvent.click(document.querySelector('[aria-label="שאל את סנסיי"]') as HTMLElement);
    fireEvent.input(document.querySelector('[aria-label="הקלדת שאלה"]') as HTMLInputElement, {
      target: { value: 'מי הבא?' },
    });
    fireEvent.click(document.querySelector('[aria-label="שליחה"]') as HTMLElement);

    // Collapsed: a 1-line chip naming the API path, with the detail hidden.
    const chip = await waitFor(() => {
      const el = [...document.querySelectorAll('[aria-expanded]')].find((b) =>
        b.textContent?.includes('/assistant/context/agenda'),
      );
      if (!el) throw new Error('tool chip not rendered');
      return el as HTMLElement;
    });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.textContent).not.toContain('"status": 200');

    // Expand → the full request/response is shown.
    fireEvent.click(chip);
    await waitFor(() => expect(document.body.textContent).toContain('"status": 200'));
    expect(document.body.textContent).toContain('/assistant/context/agenda');
  });

  it('renders a #/patient/<id> deep link as a clickable card link, not raw text', async () => {
    const id = '72565397-8e07-4ad8-ac94-38dfc4de2a63';
    const frames = [
      'data: {"type":"start"}\n\n',
      'data: {"type":"text-start","id":"0"}\n\n',
      `data: {"type":"text-delta","id":"0","delta":"הכרטיס של דנה: #/patient/${id}"}\n\n`,
      'data: {"type":"text-end","id":"0"}\n\n',
      'data: {"type":"finish"}\n\n',
      'data: [DONE]\n\n',
    ];
    fetchMock.mockImplementation(async () => sseResponse(frames));

    render(
      <AppStoreProvider>
        <AiAssistant />
      </AppStoreProvider>,
    );
    fireEvent.click(document.querySelector('[aria-label="שאל את סנסיי"]') as HTMLElement);
    fireEvent.input(document.querySelector('[aria-label="הקלדת שאלה"]') as HTMLInputElement, {
      target: { value: 'קישור לדנה' },
    });
    fireEvent.click(document.querySelector('[aria-label="שליחה"]') as HTMLElement);

    const link = await waitFor(() => {
      const a = document.querySelector(`a[href="#/patient/${id}"]`);
      if (!a) throw new Error('patient link not rendered');
      return a as HTMLAnchorElement;
    });
    // Friendly label, and the raw id is NOT shown as bubble text.
    expect(link.textContent).toBe('פתיחת הכרטיס');
    const bubble = link.closest('div');
    expect(bubble?.textContent).not.toContain(id);
  });
});
