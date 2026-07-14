// Session-prep report content (demo). Single source shared by the desktop
// ReportPage and the mobile prep report, so the two stay identical. Leaf data
// module — no imports. Real per-patient AI content would replace these when a
// backend is wired.

export function reportIntro(name: string): string {
  return name + ' נמצא/ת במגמת שיפור כללית. בפגישה האחרונה הודגמה התקדמות משמעותית ביישום כלי הוויסות. להלן הנקודות המרכזיות לקראת הפגישה הבאה.';
}

export const REPORT_CHANGES: string[] = [
  'שיפור ניכר ביכולת השימוש העצמאי בטכניקות הרגעה ברגעי לחץ',
  'דיווח על אירוע התמודדות מוצלח (הצגה בעבודה). חוויית מסוגלות ראשונה מסוגה',
  'עלייה קלה בחשש מאירועים עתידיים שדורשת מעקב',
];

export const REPORT_OPEN: string[] = [
  'עיבוד הפחד מ"הפעם הבאה" וביסוס תחושת המסוגלות',
  'בחינת דפוסי שינה בתקופות לחץ',
  'הרחבת רשת התמיכה החברתית',
];

// Suggested opening questions for the upcoming session. Demo-only — the live
// report has no questions field, so these show only in demo/offline mode.
export const REPORT_QUESTIONS: string[] = [
  'מאז שנפגשנו, היה רגע שבו הצלחת לעצור ולהשתמש באחד הכלים שתרגלנו?',
  'כשאתה חושב על הפגישה הקרובה, מה הכי חשוב לך שנספיק לגעת בו?',
];
