import { Injectable } from '@nestjs/common';
import { SEED_MOCK_MODEL } from '../mock/seed';
import { GeneratedReport, ReportGenerator } from './report-generator.interface';

/** Canned Hebrew prep report served in MOCK_MODE (aligned with the seed summary themes). */
const MOCK_INTRO =
  'המטופל/ת ממשיך/ה בתהליך טיפולי יציב סביב התמודדות עם לחץ בעבודה ושיפור דפוסי השינה. ' +
  'בפגישות האחרונות נצפתה התקדמות עקבית בתרגול הטכניקות שנלמדו.';
const MOCK_CHANGES = [
  'שיפור ניכר בדפוסי השינה בעקבות תרגול קבוע',
  'ירידה בעוצמת תחושת הלחץ בעבודה',
  'התמדה בתרגול נשימות יומי והבניית סדר יום',
];
const MOCK_OPEN_TOPICS = [
  'המשך מעקב אחר איכות השינה',
  'זיהוי טריגרים ללחץ בסביבת העבודה',
  'בחינת הרחבת טכניקות הוויסות הרגשי',
];

/** MOCK_MODE prep-report generator — returns a canned Hebrew report immediately. */
@Injectable()
export class MockReportGenerator implements ReportGenerator {
  /** Returns the canned report (fresh arrays so callers can never share state). */
  generate(): Promise<GeneratedReport> {
    return Promise.resolve({
      intro: MOCK_INTRO,
      changes: [...MOCK_CHANGES],
      openTopics: [...MOCK_OPEN_TOPICS],
      model: SEED_MOCK_MODEL,
    });
  }
}
