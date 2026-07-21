// Normalize meeting-summary `text` — JSON (new prompts) or Hebrew ## markdown.
// Maps into the Summary page slots (תקציר / נושאים / דגלי סיכון / המשך),
// matching the Simba mock shape: prose narrative + short topic bullets + risk chips.

export interface ParsedSummarySections {
  overview: string
  mainTopics: string[]
  interventions: string[]
  riskSigns: string
  followUp: string[]
  /** Display text for the editable “תקציר” block (Hebrew prose, not raw JSON). */
  displayText: string
}

const CANONICAL_KEYS = [
  'main_topics',
  'therapist_interventions',
  'risk_signs',
  'follow_up',
] as const;

type CanonicalKey = (typeof CANONICAL_KEYS)[number];

/** Map model/legacy key spellings → canonical English keys. */
const KEY_ALIASES: Record<string, CanonicalKey> = {
  main_topics: 'main_topics',
  topics: 'main_topics',
  mainTopics: 'main_topics',
  key_topics: 'main_topics',
  keyTopics: 'main_topics',
  'נושאים': 'main_topics',
  'נושאים_מרכזיים': 'main_topics',
  'נושאים מרכזיים': 'main_topics',
  therapist_interventions: 'therapist_interventions',
  interventions: 'therapist_interventions',
  therapistInterventions: 'therapist_interventions',
  'התערבויות': 'therapist_interventions',
  'התערבויות_המטפל': 'therapist_interventions',
  'התערבויות המטפל': 'therapist_interventions',
  risk_signs: 'risk_signs',
  risk: 'risk_signs',
  riskSigns: 'risk_signs',
  risks: 'risk_signs',
  'סיכון': 'risk_signs',
  'סימני_סיכון': 'risk_signs',
  'סימני סיכון': 'risk_signs',
  follow_up: 'follow_up',
  followup: 'follow_up',
  followUp: 'follow_up',
  homework: 'follow_up',
  next_steps: 'follow_up',
  'המשך': 'follow_up',
  'המשך_ומעקב': 'follow_up',
  'המשך ומעקב': 'follow_up',
};

function stripFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return text.trim();
}

function looksLikeJsonBlob(text: string): boolean {
  const t = text.trim();
  return (t.startsWith('{') && t.includes('}')) || (t.startsWith('[') && t.includes(']'));
}

function normalizeKeyMap(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(data)) {
    if (value != null && typeof value === 'object' && !Array.isArray(value)) continue;
    const key = rawKey.trim();
    const canon = KEY_ALIASES[key] || KEY_ALIASES[key.replace(/\s+/g, '_')] || KEY_ALIASES[key.replace(/_/g, ' ')];
    if (!canon) continue;
    if (out[canon] == null || out[canon] === '') out[canon] = value;
  }
  return out;
}

function looksLikeSummary(data: Record<string, unknown>): boolean {
  return CANONICAL_KEYS.some((k) => k in data && data[k] != null && String(data[k]).trim() !== '');
}

// Split prose into discrete items: on newlines, list separators, and sentence
// terminators — mirrors the backend so a paragraph becomes scannable bullets
// instead of one giant line. Keeps array items intact (already discrete).
const SEGMENT_SPLIT = /(?<=[.!?…])\s+|[\n;•·]+/;
const LEADING_MARKER = /^(?:[-*•·]\s*|\d+[.)]\s*)/;

function splitSegments(text: string): string[] {
  return text
    .split(SEGMENT_SPLIT)
    .map((seg) => seg.replace(LEADING_MARKER, '').trim())
    .filter(Boolean);
}

function asLines(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return splitSegments(String(value).trim());
}

function asProse(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean).join(' ');
  }
  return String(value).trim();
}

/** Prefer last valid summary-shaped object (broken outer + clean nested JSON). */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = stripFences(raw);
  const tryParse = (slice: string): Record<string, unknown> | null => {
    try {
      const data = JSON.parse(slice);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      const normalized = normalizeKeyMap(data as Record<string, unknown>);
      if (looksLikeSummary(normalized)) return normalized;
      // Nested summary object (e.g. { data: { main_topics: ... } })
      for (const v of Object.values(data as Record<string, unknown>)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const nested = normalizeKeyMap(v as Record<string, unknown>);
          if (looksLikeSummary(nested)) return nested;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const end = cleaned.lastIndexOf('}');
  if (end < 0) return null;
  for (let start = end; start >= 0; start -= 1) {
    if (cleaned[start] !== '{') continue;
    const found = tryParse(cleaned.slice(start, end + 1));
    if (found) return found;
  }
  return null;
}

function bulletsUnderHeading(text: string, heading: string): string[] {
  const lines = text.split(/\r?\n/);
  const items: string[] = [];
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      const title = line.replace(/^##\s+/, '').trim();
      inSection = title === heading || title.includes(heading);
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      items.push(line.slice(2).trim());
    } else if (line) {
      items.push(...splitSegments(line));
    }
  }
  return items.filter(Boolean);
}

function sectionBody(text: string, heading: string): string {
  const lines = text.split(/\r?\n/);
  const body: string[] = [];
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      const title = line.replace(/^##\s+/, '').trim();
      inSection = title === heading || title.includes(heading);
      continue;
    }
    if (inSection) body.push(raw);
  }
  return body.join('\n').trim();
}

function fromJson(data: Record<string, unknown>): ParsedSummarySections {
  const mainTopicsRaw = data.main_topics;
  const interventionsRaw = data.therapist_interventions;
  const riskRaw = data.risk_signs;
  const followRaw = data.follow_up;

  const mainTopicLines = asLines(mainTopicsRaw);
  const interventions = asLines(interventionsRaw);
  const followUp = asLines(followRaw);
  const riskSigns = asProse(riskRaw) || 'לא נאמרו אמירות מפורשות של סיכון';
  // תקציר = flowing prose (Simba-style). Follow-up lives in its own section.
  const overview = asProse(mainTopicsRaw);
  const interventionProse = asProse(interventionsRaw);

  const displayText = [overview, interventionProse].filter(Boolean).join('\n\n');

  return {
    overview: overview || '',
    mainTopics: mainTopicLines.length ? mainTopicLines : (overview ? [overview] : []),
    interventions,
    riskSigns,
    followUp,
    displayText: displayText || overview || '',
  };
}

function fromMarkdown(text: string): ParsedSummarySections {
  const riskBody = sectionBody(text, 'סימני סיכון');
  const followBullets = bulletsUnderHeading(text, 'המשך ומעקב');
  const topicBullets = bulletsUnderHeading(text, 'נושאים מרכזיים');
  const interventionBullets = bulletsUnderHeading(text, 'התערבויות המטפל');

  const overview = topicBullets.join(' ');
  const displayText = [overview, interventionBullets.join(' ')].filter(Boolean).join('\n\n');

  return {
    overview: overview || text.trim(),
    mainTopics: topicBullets,
    interventions: interventionBullets,
    riskSigns: riskBody.replace(/^[-*•]\s*/gm, '').trim() || 'לא נאמרו אמירות מפורשות של סיכון',
    followUp: followBullets,
    displayText: displayText || overview || '',
  };
}

/** Parse API/local summary text into UI sections. Never returns raw JSON as displayText. */
export function parseSummaryContent(raw: string | null | undefined): ParsedSummarySections | null {
  if (!raw || !String(raw).trim()) return null;
  const text = String(raw).trim();
  const json = parseJsonObject(text);
  if (json) return fromJson(json);
  if (text.includes('## ')) return fromMarkdown(text);

  // Unrecognized JSON-looking blob — do not print braces/keys in the UI.
  if (looksLikeJsonBlob(text)) {
    return {
      overview: '',
      mainTopics: [],
      interventions: [],
      riskSigns: '',
      followUp: [],
      displayText: 'לא ניתן להציג את הסיכום בפורמט הנוכחי. נסו לייצר מחדש או לערוך ידנית.',
    };
  }

  return {
    overview: text,
    mainTopics: [],
    interventions: [],
    riskSigns: '',
    followUp: [],
    displayText: text,
  };
}

/** One-line preview for history / recap chips (never raw JSON). */
export function summaryPreviewText(raw: string | null | undefined, max = 140): string {
  const parsed = parseSummaryContent(raw);
  const line = (parsed?.displayText || parsed?.overview || '').replace(/\s+/g, ' ').trim();
  if (!line) return '';
  if (line.length <= max) return line;
  return line.slice(0, max).trim() + '…';
}
