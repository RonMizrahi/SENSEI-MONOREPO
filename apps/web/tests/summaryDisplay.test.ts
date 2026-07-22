import { describe, expect, it } from 'vitest';
import { parseSummaryContent, summaryPreviewText } from '../src/services/summaryDisplay';

const SAMPLE_JSON = `{
  "main_topics": "המטופל הגיע עם חרדה סביב אירוע בעבודה. נדונו דפוסי שינה ושימוש בכלי ויסות.",
  "therapist_interventions": "שוקף החרדה, חודדה נשימה שנלמדה, וניתנה משימת תרגול קצרה לשבוע.",
  "risk_signs": "לא נאמרו אמירות מפורשות של סיכון",
  "follow_up": ["לחזור לדפוסי שינה בתקופות לחץ", "לחזק תחושת מסוגלות אחרי הצלחה"]
}`;

describe('parseSummaryContent', () => {
  it('maps JSON fields into תקציר / נושאים / סיכון / המשך (never raw keys)', () => {
    const p = parseSummaryContent(SAMPLE_JSON)!;
    expect(p.displayText).not.toMatch(/[{}"]/);
    expect(p.displayText).toContain('חרדה סביב אירוע בעבודה');
    expect(p.displayText).toContain('שוקף החרדה');
    expect(p.mainTopics.length).toBeGreaterThan(0);
    expect(p.mainTopics.some((t) => t.includes('חרדה'))).toBe(true);
    expect(p.riskSigns).toContain('לא נאמרו');
    expect(p.followUp).toEqual([
      'לחזור לדפוסי שינה בתקופות לחץ',
      'לחזק תחושת מסוגלות אחרי הצלחה',
    ]);
    // Follow-up is a dedicated section — not duplicated inside תקציר.
    expect(p.displayText).not.toContain('המשך:');
  });

  it('accepts camelCase / Hebrew key aliases', () => {
    const p = parseSummaryContent(JSON.stringify({
      'נושאים מרכזיים': 'נושא א',
      therapistInterventions: 'התערבות ב',
      'סימני סיכון': 'לא נאמרו אמירות מפורשות של סיכון',
      followUp: ['מעקב'],
    }))!;
    expect(p.overview).toContain('נושא א');
    expect(p.displayText).toContain('התערבות ב');
    expect(p.followUp).toEqual(['מעקב']);
  });

  it('parses Hebrew ## markdown from the API normalizer', () => {
    const md = [
      '## נושאים מרכזיים',
      '- חרדת ביצוע',
      '- הפרעות שינה',
      '',
      '## התערבויות המטפל/ת',
      '- שיקוף ונשימה',
      '',
      '## סימני סיכון',
      'לא נאמרו אמירות מפורשות של סיכון',
      '',
      '## המשך ומעקב',
      '- תרגול נשימה בבית',
    ].join('\n');
    const p = parseSummaryContent(md)!;
    expect(p.mainTopics).toEqual(['חרדת ביצוע', 'הפרעות שינה']);
    expect(p.interventions).toEqual(['שיקוף ונשימה']);
    expect(p.followUp).toEqual(['תרגול נשימה בבית']);
    expect(p.displayText).toContain('חרדת ביצוע');
    expect(p.displayText).not.toContain('##');
  });

  it('does not dump unparseable JSON braces into displayText', () => {
    const p = parseSummaryContent('{ "foo": "bar", "baz": 1 }')!;
    expect(p.displayText).not.toMatch(/[{}]/);
    expect(p.displayText).toContain('לא ניתן להציג');
    expect(p.mainTopics).toEqual([]);
  });

  it('recovers a nested clean object from broken outer JSON', () => {
    const raw = '{\n  "main_topics": "עברית לא סגורה\n\n{\n  "main_topics": "שינה וחרדה",\n  "therapist_interventions": "נשימה",\n  "risk_signs": "לא נאמרו אמירות מפורשות של סיכון",\n  "follow_up": ["מעקב שינה"]\n}\n';
    const p = parseSummaryContent(raw)!;
    expect(p.overview).toContain('שינה וחרדה');
    expect(p.followUp).toContain('מעקב שינה');
  });
});

describe('summaryPreviewText', () => {
  it('returns a short prose line for history chips', () => {
    const line = summaryPreviewText(SAMPLE_JSON, 40);
    expect(line.endsWith('…')).toBe(true);
    expect(line).not.toMatch(/[{}"]/);
    expect(line).toContain('חרדה');
  });
});
