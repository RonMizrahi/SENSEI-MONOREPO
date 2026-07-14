// Sharing utilities — build WhatsApp / mailto share targets from plain text with proper
// UTF-8 percent-encoding (Hebrew, English, mixed RTL/LTR, numbers, line breaks all round-
// trip correctly), and sanitize payloads so no control characters / accidental internal
// tokens leak into a shared message. Pure and framework-free — the ShareMenu component and
// the unit tests consume these. This is a LEAF module: it imports nothing from UI/state.

// Drop control characters except TAB (9) and LF (10); CR is normalized to LF first.
// Char-code filter (not a regex) so no control-char literals live in source.
function stripControlChars(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || (c >= 32 && c !== 127)) out += s[i];
  }
  return out;
}

// Normalize newlines, strip control chars, trim trailing spaces, collapse excess blank
// lines. Preserves Hebrew/English text and intended line breaks.
export function sanitizeShareText(text: string): string {
  return stripControlChars(String(text ?? '').replace(/\r\n?/g, '\n'))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// True when there is real content to share (after sanitizing).
export function canShare(text: string): boolean {
  return sanitizeShareText(text).length > 0;
}

// https://wa.me/?text=<encoded> — handled by both mobile WhatsApp and WhatsApp Web.
export function buildWhatsAppUrl(text: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(sanitizeShareText(text));
}

// mailto with an encoded subject + body. `to` is intentionally optional and defaults to
// empty — we never auto-fill a recipient (no PII leakage); the user picks the recipient in
// their mail client. Line breaks (%0A) and Hebrew/mixed text render correctly.
export function buildMailtoUrl(opts: { subject: string; body: string; to?: string }): string {
  const to = opts.to ? encodeURIComponent(opts.to) : '';
  const query =
    'subject=' + encodeURIComponent(sanitizeShareText(opts.subject)) +
    '&body=' + encodeURIComponent(sanitizeShareText(opts.body));
  return 'mailto:' + to + '?' + query;
}
