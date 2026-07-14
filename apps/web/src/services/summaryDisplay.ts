// Normalize meeting-summary `text` — JSON (new prompts) or Hebrew ## markdown.

export interface ParsedSummarySections {
  overview: string
  mainTopics: string[]
  interventions: string[]
  riskSigns: string
  followUp: string[]
  /** Display text for the editable “תקציר” block (Hebrew prose, not raw JSON). */
  displayText: string
}

const SUMMARY_KEYS = new Set([
  'main_topics',
  'topics',
  'therapist_interventions',
  'interventions',
  'risk_signs',
  'risk',
  'follow_up',
  'followup',
]);

function stripFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return text.trim();
}

function looksLikeSummary(data: Record<string, unknown>): boolean {
  return Object.keys(data).some((k) => SUMMARY_KEYS.has(k));
}

function asLines(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const s = String(value).trim();
  if (!s) return [];
  if (s.includes('\n')) {
    return s.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
  }
  return [s];
}

/** Prefer last valid summary-shaped object (broken outer + clean nested JSON). */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = stripFences(raw);
  try {
    const data = JSON.parse(cleaned);
    if (data && typeof data === 'object' && !Array.isArray(data) && looksLikeSummary(data as Record<string, unknown>)) {
      return data as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }

  const end = cleaned.lastIndexOf('}');
  if (end < 0) return null;
  for (let start = end; start >= 0; start -= 1) {
    if (cleaned[start] !== '{') continue;
    try {
      const data = JSON.parse(cleaned.slice(start, end + 1));
      if (data && typeof data === 'object' && !Array.isArray(data) && looksLikeSummary(data as Record<string, unknown>)) {
        return data as Record<string, unknown>;
      }
    } catch {
      /* try earlier `{` */
    }
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
      items.push(line);
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
  const mainTopicsRaw = data.main_topics ?? data.topics;
  const interventionsRaw = data.therapist_interventions ?? data.interventions;
  const riskRaw = data.risk_signs ?? data.risk;
  const followRaw = data.follow_up ?? data.followup;

  const mainTopicLines = asLines(mainTopicsRaw);
  const interventions = asLines(interventionsRaw);
  const followUp = asLines(followRaw);
  const riskSigns = asLines(riskRaw).join(' ') || 'לא נאמרו אמירות מפורשות של סיכון';
  const overview = typeof mainTopicsRaw === 'string'
    ? mainTopicsRaw.trim()
    : mainTopicLines.join(' ');

  const displayText = [
    overview,
    interventions.length ? interventions.join(' ') : '',
    followUp.length ? ('המשך: ' + followUp.join(' · ')) : '',
  ].filter(Boolean).join('\n\n');

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
  const topicsBody = sectionBody(text, 'נושאים מרכזיים');
  const interventionsBody = sectionBody(text, 'התערבויות המטפל');
  const riskBody = sectionBody(text, 'סימני סיכון');
  const followBullets = bulletsUnderHeading(text, 'המשך ומעקב');
  const topicBullets = bulletsUnderHeading(text, 'נושאים מרכזיים');
  const interventionBullets = bulletsUnderHeading(text, 'התערבויות המטפל');

  return {
    overview: topicsBody || text.trim(),
    mainTopics: topicBullets.length ? topicBullets : (topicsBody ? [topicsBody] : []),
    interventions: interventionBullets.length ? interventionBullets : (interventionsBody ? [interventionsBody] : []),
    riskSigns: riskBody || 'לא נאמרו אמירות מפורשות של סיכון',
    followUp: followBullets,
    displayText: topicsBody || text.trim(),
  };
}

/** Parse API/local summary text into UI sections. */
export function parseSummaryContent(raw: string | null | undefined): ParsedSummarySections | null {
  if (!raw || !String(raw).trim()) return null;
  const text = String(raw).trim();
  const json = parseJsonObject(text);
  if (json) return fromJson(json);
  if (text.includes('## ')) return fromMarkdown(text);
  return {
    overview: text,
    mainTopics: [],
    interventions: [],
    riskSigns: '',
    followUp: [],
    displayText: text,
  };
}
