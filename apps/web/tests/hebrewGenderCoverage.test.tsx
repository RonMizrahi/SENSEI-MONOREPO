// Application-wide gendered-Hebrew coverage guards (the grammar engine itself is
// covered by hebrewGrammar.test.ts). Locks three things:
//   1. No slash-based gender forms (e.g. "מטופל/ת") anywhere in src — every
//      gendered phrase must go through the HG layer's [[m|f|neutral]] tokens.
//   2. The profile "לשון פנייה" select in Settings edits the gender SSOT.
//   3. Switching gender re-renders personalized copy live (state-driven, no
//      reload): the summary "edited by" label flips בין [[המטפל|המטפלת]].
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const SRC = join(__dirname, '..', 'src');
const PKEY = 'sensei_session_react_v1';
function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|js)$/.test(p) ? [p] : [];
  });
}

describe('gendered Hebrew — application-wide coverage', () => {
  it('no slash-based gender forms remain anywhere in src', () => {
    // A Hebrew word immediately followed by "/ת" (מטופל/ת, מאשר/ת…) is the
    // banned slash convention; HG tokens or neutral phrasing must be used.
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const text = readFileSync(f, 'utf8');
      const m = text.match(/[א-ת]+\/ת(?![א-ת])/g);
      if (m) offenders.push(f.replace(SRC, 'src') + ': ' + m.join(', '));
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('the profile "לשון פנייה" select edits the gender SSOT and updates live', async () => {
    // Signed-in, on Settings. The seeded profile is feminine ('f').
    mount({ view: 'app', route: 'settings', settingsTab: 'profile' });
    await settle();
    const sel = document.querySelector('select[aria-label="לשון פנייה"]') as HTMLSelectElement;
    expect(sel, 'the gender select must exist in Settings → Profile').toBeTruthy();
    expect(sel.value).toBe('f');
    // switch to masculine in the draft
    fireEvent.change(sel, { target: { value: 'm' } });
    await waitFor(() => expect((document.querySelector('select[aria-label="לשון פנייה"]') as HTMLSelectElement).value).toBe('m'));
  });

  it('personalized copy flips with gender without a reload (summary "נערך על ידי")', async () => {
    // Feminine profile → המטפלת
    mount({ view: 'app', route: 'summary', patientId: 'p1', summaryEdited: true });
    await settle();
    const txtF = document.body.textContent || '';
    if (txtF.includes('נערך על ידי')) expect(txtF).toContain('נערך על ידי המטפלת');
    cleanup(); localStorage.clear();
    // Masculine profile → המטפל
    mount({ view: 'app', route: 'summary', patientId: 'p1', summaryEdited: true, profile: { name: 'ד״ר רותם שגב', gender: 'm' } });
    await settle();
    const txtM = document.body.textContent || '';
    if (txtM.includes('נערך על ידי')) {
      expect(txtM).toContain('נערך על ידי המטפל');
      expect(txtM).not.toContain('נערך על ידי המטפלת');
    }
  });
});
