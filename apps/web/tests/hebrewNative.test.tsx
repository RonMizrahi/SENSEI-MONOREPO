// Hebrew-native regression guards — the two invariants no other test pinned:
// (1) the document declares Hebrew + RTL, and (2) no unintended English leaks
// into any rendered screen. Latin text is allowed ONLY via the explicit
// allowlist below (clinical acronyms, brand/technical terms, technical strings
// like emails/IDs) — adding an untranslated "Submit" anywhere fails this suite.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';
import { ROUTE_TITLES } from '../src/nav/navConfig';

const ROUTES = Object.keys(ROUTE_TITLES);

const PKEY = 'sensei_session_react_v1';
const settle = () => act(() => new Promise((r) => setTimeout(r, 120)));
afterEach(() => { cleanup(); localStorage.clear(); });

// Sanctioned Latin: clinical acronyms/instruments, brand + file-format terms,
// and technical-string fragments (emails, IDs, units). Reviewed 2026-07-06.
const ALLOW = new Set([
  'AI', 'Whisper', 'Google', 'PDF', 'MP3', 'WAV', 'M4A', 'SMS', 'Pro', 'Audit', 'Log',
  'RBAC', 'PII', 'AES', 'EMDR', 'DBT', 'CBT', 'PTSD', 'OCD', 'ACT', 'CFT', 'MB', 'GB',
  'GAD', 'PHQ', 'WHO', 'ORS', 'SRS', 'OQ', 'SNS', 'ID', 'Zoom', 'iPhone', 'iPad', 'Mac',
  'Windows', 'Chrome', 'Safari', 'Excel', 'Word', 'TLS', 'HIPAA', 'GDPR', 'Heebo', 'K',
  'Calendar', // only as part of the "Google Calendar" integration brand name
  'Ctrl', 'Esc', 'Enter', 'Shift', 'Alt', // keyboard keys outside <kbd> (help page prose)
]);
// tokens inside technical strings the UI deliberately renders LTR
const TECHNICAL = /^(?:[\w.+-]+@[\w.-]+|https?:\/\/\S*|[\w-]+\.(?:co\.il|com|org|il)|v?\d[\w.:-]*|[A-F0-9]{4,}|[A-Z]{2,5}-\d{4,})$/i;
// clinical instruments & scales (PHQ-9, GAD-7, EDE-Q, Y-BOCS, PROMs), sized
// units (AES-256) and short technical ids (C1). All-caps hyphenated groups are
// acronyms by this app's convention — a real untranslated English word arrives
// in sentence case and still fails.
const ACRONYM = /^(?:[A-Z0-9]{1,6}(?:-[A-Z0-9]{1,6})*s?)$/;

function latinLeaks(): string[] {
  // walk individual text nodes (whole-body textContent concatenates adjacent
  // chips into fake tokens like "CBTDBTEMDR"), strip edge punctuation
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const leaks = new Set<string>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    // keyboard keys are physical Latin glyphs (Ctrl, Esc, Enter…) — sanctioned
    if ((n.parentElement && n.parentElement.closest('kbd'))) continue;
    const tokens = (n.textContent || '').match(/[A-Za-z][A-Za-z0-9'’._@/-]*/g) || [];
    for (let t of tokens) {
      t = t.replace(/[._-]+$/, '');
      if (!ALLOW.has(t) && !TECHNICAL.test(t) && !ACRONYM.test(t)) leaks.add(t);
    }
  }
  return [...leaks];
}

function mount(patch: Record<string, any>) {
  localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), ...patch }));
  return render(<AppStoreProvider><App /></AppStoreProvider>);
}

describe('document language & direction', () => {
  it('declares lang="he" and dir="rtl" on the root element', async () => {
    mount({ view: 'app', route: 'dashboard' });
    await settle();
    expect(document.documentElement.getAttribute('lang')).toBe('he');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

describe('no unintended English on any screen', () => {
  for (const route of ROUTES) {
    it(`route "${route}" renders Hebrew-only (allowlisted Latin excepted)`, async () => {
      mount({ view: 'app', route, patientId: 'p1' });
      await settle();
      expect(latinLeaks(), `unexpected Latin text on "${route}" — translate it or add to the reviewed allowlist`).toEqual([]);
      cleanup();
      localStorage.clear();
    });
  }

  for (const authScreen of ['login', 'signup', 'forgot', 'expired', 'unauthorized']) {
    it(`auth screen "${authScreen}" renders Hebrew-only`, async () => {
      mount({ view: 'auth', authScreen });
      await settle();
      expect(latinLeaks(), `unexpected Latin text on auth "${authScreen}"`).toEqual([]);
      cleanup();
      localStorage.clear();
    });
  }
});
