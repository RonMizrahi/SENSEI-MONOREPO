// Per-session demo content — insight + transcript excerpts for detail & prep report.
import { sessionSummaries } from './sessions';

const INSIGHTS = [
  'נצפה שימוש עצמאי בכלי ויסות תחת לחץ. כדאי לחזק את חוויית המסוגלות ולקשר אותה לאירועים עתידיים.',
  'חרדת הביצוע עדיין מניעה הימנעות, אך יש סימני התמודדות מוצלחת. המשך חשיפה הדרגתית מומלץ.',
  'עלו קשיים ביחסים בין-אישיים וגבולות. רגישות רגשית גבוהה מהממוצע בפגישות קודמות.',
  'מצב רוח ירוד יחסית. כדאי לבחון טריגרים מהשבוע האחרון.',
  'התקדמות יציבה במטרות הטיפול. המטופל/ת מדווח/ת על שימוש עצמאי בכלים.',
  'דפוסי התקשרות ממשפחת המוצא עדיין משפיעים. נדרש ויסות במהלך העיבוד.',
  'מוטיבציה גבוהה לשינוי. זמן טוב להגדרת מטרות לרבעון הקרוב.',
  'פגישת פתיחה: מיפוי תלונות, ציפיות וקצב טיפולי מתאים.',
];

const TRANSCRIPT_EXCERPTS = [
  [
    { speaker: 'מטפל/ת', text: 'אז ספרי לי איך עבר עליך השבוע מאז שנפגשנו.' },
    { speaker: 'מטופל/ת', text: 'הייתה לי הצגה גדולה בעבודה וכמה ימים לפני זה כמעט לא הצלחתי לישון.' },
    { speaker: 'מטופל/ת', text: 'ניסיתי בבוקר ההצגה את הנשימה שתרגלנו וזה דווקא עזר. הרגשתי גאווה אחרי.' },
  ],
  [
    { speaker: 'מטופל/ת', text: 'עדיין מפחדת מלהיכשל מול אנשים חדשים בעבודה.' },
    { speaker: 'מטפל/ת', text: 'מה קרה בפעם האחרונה שניסית להתמודד עם זה?' },
    { speaker: 'מטופל/ת', text: 'הצלחתי להישאר בחדר ישיבה שלם, למרות שהלב דפק.' },
  ],
  [
    { speaker: 'מטופל/ת', text: 'קשה לי להגיד לא לאמא, ואז אני מתרגזת על עצמי.' },
    { speaker: 'מטפל/ת', text: 'בואי נבחן מה קורה בגוף ברגע שאת מרגישה שאי אפשר לסרב.' },
  ],
  [
    { speaker: 'מטופל/ת', text: 'השבוע היה קשה. הרגשתי ריקנות אחרי הפרידה מהחברה.' },
    { speaker: 'מטפל/ת', text: 'מתי התחיל להיות שונה?' },
  ],
  [
    { speaker: 'מטופל/ת', text: 'השתמשתי ביומן הרגשות בכל יום השבוע.' },
    { speaker: 'מטפל/ת', text: 'זו התקדמות משמעותית. מה למדת על עצמך?' },
  ],
  [
    { speaker: 'מטופל/ת', text: 'אבא שלי תמיד אמר שצריך להיות חזק. זה עדיין מלווה אותי.' },
    { speaker: 'מטפל/ת', text: 'איך זה משפיע על הדרך שאת מבקשת עזרה?' },
  ],
  [
    { speaker: 'מטופל/ת', text: 'אני רוצה להמשיך, אבל חוששת שזה ייקח הרבה זמן.' },
    { speaker: 'מטפל/ת', text: 'בואי נגדיר יחד מה נראה כמו צעד קדימה ריאלי.' },
  ],
  [
    { speaker: 'מטופל/ת', text: 'הגעתי כי החרדה מפריעה לי לישון ולעבוד.' },
    { speaker: 'מטפל/ת', text: 'תודה על הפתיחות. נתחיל מלמפות מתי זה מורגש הכי חזק.' },
  ],
];

export interface TranscriptLine {
  speaker: string
  text: string
}

export function sessionInsight(_p: unknown, index: number): string {
  return INSIGHTS[index % INSIGHTS.length];
}

export function sessionSummaryText(p: unknown, index: number): string {
  return sessionSummaries(p)[index % sessionSummaries(p).length];
}

export function sessionTranscriptExcerpt(_p: unknown, index: number): TranscriptLine[] {
  return TRANSCRIPT_EXCERPTS[index % TRANSCRIPT_EXCERPTS.length];
}

/** Index in the session list (0 = most recent) for a session number within a total count. */
export function sessionIndexForNum(sessionNum: number, total: number): number {
  return total - sessionNum;
}
