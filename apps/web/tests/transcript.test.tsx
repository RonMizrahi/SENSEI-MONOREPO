// Transcript viewer — rendering, in-transcript search filtering, and match highlighting.
// The transcript search now reuses the app's canonical `hlParts` highlighter (as the
// global search / palette / search page do), so a matched term is both filtered to and
// visually highlighted — consistent search UX across the whole app. Regression guard for
// that behaviour.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
afterEach(() => { cleanup(); localStorage.clear(); });

const searchBox = () => document.querySelector('.trs-search') as HTMLInputElement;
const bubbles = () => document.querySelectorAll('#main-content [style*="max-width: 76%"]');
// a highlighted match = a span whose own text is exactly the query (hlParts wraps the match)
const highlightsOf = (q: string) =>
  [...document.querySelectorAll('#main-content span')].filter((s) => s.textContent === q && s.children.length === 0);

async function openTranscript() {
  mount({ view: 'app', route: 'transcript', patientId: 'p1' });
  await settle();
  await waitFor(() => expect(searchBox()).toBeTruthy());
}

describe('transcript viewer — rendering, search filter & highlight', () => {
  it('renders the two-sided transcript (speaker labels + timestamps)', async () => {
    await openTranscript();
    expect(bubbles().length, 'multiple transcript lines render').toBeGreaterThan(1);
    // gendered speaker label + a timestamp are present
    expect(document.body.textContent).toMatch(/\d\d:\d\d/); // e.g. 00:12
  });

  it('a query filters to matching lines and highlights the matched term', async () => {
    await openTranscript();
    const all = bubbles().length;
    fireEvent.change(searchBox(), { target: { value: 'הצגה' } });
    await waitFor(() => expect(highlightsOf('הצגה').length).toBeGreaterThan(0));
    // filtered to fewer lines than the full transcript, and every shown match is highlighted
    expect(bubbles().length).toBeLessThan(all);
    const hl = highlightsOf('הצגה')[0] as HTMLElement;
    // assert on the inline style tokens (jsdom does not resolve var() in getComputedStyle;
    // the real browser renders var(--selection) + bold — verified in preview)
    expect(hl.style.fontWeight, 'match is bolded').toBe('700');
    expect(hl.style.background, 'match carries the selection highlight token').toContain('--selection');
  });

  it('clearing the query restores all lines and removes highlighting', async () => {
    await openTranscript();
    const all = bubbles().length;
    fireEvent.change(searchBox(), { target: { value: 'הצגה' } });
    await waitFor(() => expect(bubbles().length).toBeLessThan(all));
    fireEvent.change(searchBox(), { target: { value: '' } });
    await waitFor(() => expect(bubbles().length).toBe(all));
    expect(highlightsOf('הצגה').length, 'no highlight spans once the query is cleared').toBe(0);
  });

  it('a query with zero matches shows an explicit empty state with a one-click way back', async () => {
    await openTranscript();
    const all = bubbles().length;
    fireEvent.change(searchBox(), { target: { value: 'זזזזז-לא-קיים' } });
    await waitFor(() => expect(document.body.textContent).toContain('אין תוצאות לחיפוש'));
    // announced (role=status), not a silently blank card
    expect(document.querySelector('[role="status"]')).toBeTruthy();
    // the escape hatch restores the full transcript
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'ניקוי החיפוש') as HTMLElement);
    await waitFor(() => expect(bubbles().length).toBe(all));
    expect(searchBox().value).toBe('');
  });

  it('downloads the transcript as a UTF-8 text file (speaker + timestamp per line)', async () => {
    await openTranscript();
    // capture the Blob handed to the object URL instead of letting jsdom "navigate"
    let captured: Blob | null = null;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((b: Blob) => { captured = b; return 'blob:mock'; }) as any;
    URL.revokeObjectURL = (() => {}) as any;
    try {
      fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent?.includes('הורדה')) as HTMLElement);
      await waitFor(() => expect(captured).toBeTruthy());
      // jsdom's Blob lacks .text() — read through FileReader (the portable path)
      const text = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsText(captured as unknown as Blob);
      });
      expect(text).toContain('[00:12]'); // timestamped
      expect(text).toContain('שבוע די קשה'); // real transcript content
      expect((captured as unknown as Blob).type).toContain('text/plain');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
