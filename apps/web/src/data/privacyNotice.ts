// Single source of truth for the privacy notice shown across the app (upload
// experience + Help hub). The displayed items are DERIVED from the application's
// actual capabilities — never hardcoded per environment — so the UI always
// matches what the app really does. When a backend privacy/capabilities endpoint
// or feature flags are wired, `resolvePrivacyCapabilities` is the single place to
// source them from; the notice component never changes.

export interface PrivacyCapabilities {
  /** Where the record lives. */
  storage: 'local' | 'server';
  /** Does anything leave the device? */
  transmitsToServer: boolean;
  /** Transport encryption, when data does leave the device. */
  httpsOnly?: boolean;
  /** Whether the raw audio is kept after transcription. `undefined` = unknown → omitted. */
  audioRetained?: boolean;
  /** User can export / restore / delete their own data. */
  userControls: boolean;
}

export interface PrivacyItem { id: string; icon: string; text: string }

export const PRIVACY_HEADLINE = 'ההקלטה שלך מאובטחת';
export const PRIVACY_TOOLTIP_TITLE = 'פרטיות ואבטחה';
// Shown only when no capability metadata is available (never assumes specifics).
export const PRIVACY_FALLBACK =
  'הנתונים שלכם מטופלים בהתאם למדיניות הפרטיות של המערכת. לפרטים ראו עזרה ותמיכה.';

// Icons reused from the design system's existing privacy iconography.
const IC = {
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  shield: 'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
  bin: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  user: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
};

/**
 * Resolve the app's real privacy capabilities from the runtime environment —
 * the only source of truth available in this client-only build. A wired backend
 * would source these from its own privacy/capabilities response here.
 */
export function resolvePrivacyCapabilities(apiConfigured: boolean): PrivacyCapabilities {
  if (!apiConfigured) {
    // Client-only: everything stays on the device; audio is used only to transcribe.
    return { storage: 'local', transmitsToServer: false, audioRetained: false, userControls: true };
  }
  // Backend wired: only claim what the transport guarantees. Audio retention is
  // backend policy (unknown to the client) → omitted rather than asserted.
  return { storage: 'server', transmitsToServer: true, httpsOnly: true, userControls: true };
}

/** Build the applicable, truthful privacy items for the given capabilities. */
export function privacyItems(cap: PrivacyCapabilities | null): PrivacyItem[] {
  if (!cap) return [];
  const items: PrivacyItem[] = [];
  items.push(cap.storage === 'local'
    ? { id: 'storage', icon: IC.lock, text: 'הנתונים נשמרים מקומית במכשיר שלכם בלבד' }
    : { id: 'storage', icon: IC.lock, text: 'הנתונים נשמרים בשרת המערכת' });
  if (!cap.transmitsToServer) {
    items.push({ id: 'transmit', icon: IC.shield, text: 'דבר אינו נשלח לשרת בגרסת ההדגמה' });
  } else if (cap.httpsOnly) {
    items.push({ id: 'transmit', icon: IC.shield, text: 'התקשורת מוצפנת בהעברה (HTTPS)' });
  }
  if (cap.audioRetained === false) {
    items.push({ id: 'audio', icon: IC.bin, text: 'קובץ האודיו משמש לתמלול בלבד ואינו נשמר' });
  }
  if (cap.userControls) {
    items.push({ id: 'controls', icon: IC.user, text: 'שליטה מלאה בנתונים: ייצוא, שחזור ומחיקה בהגדרות' });
  }
  return items;
}
