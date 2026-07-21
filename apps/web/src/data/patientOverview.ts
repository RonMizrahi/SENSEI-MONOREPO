// Structured "Patient Overview" — a concise, scannable snapshot shown at the top
// of the patient file: current treatment summary, primary goals, current
// challenges, and the therapist's prep notes ahead of the next session.
// Seeded per patient (Simba/p5 gets a bespoke arc); everyone else shares a
// neutral default. Stored edits live in the store's `overviewOverrides`.

export interface PatientOverview {
  summary: string
  goals: string
  challenges: string
  prep: string
}

const SIMBA_OVERVIEW: PatientOverview = {
  summary: 'סימבה, שאיבד את אביו מופאסה באירוע טראומטי בקניון. בטיפול משולב EMDR ו-CPT לעיבוד PTSD, הימנעות כרונית וקהות רגשית.',
  goals: 'עיבוד זיכרון הליבה הטראומטי · הפחתת אשמה ובושה · יציאה מדפוס ההימנעות וחזרה לתפקוד ולנטילת אחריות.',
  challenges: 'עוררות יתר וטריגרים סביבתיים · נטייה להימנעות ("האקונה מטאטה") · אשמה נוקשה על מות האב.',
  prep: 'לבדוק שמירת גבולות מול טריגרים בסביבה המקורית, ולחזק את הקוגניציה החיובית שגובשה במפגש האחרון.',
};

const DEFAULT_OVERVIEW: PatientOverview = {
  summary: 'מטופל בטיפול מתמשך, עם שיתוף פעולה טוב ומוטיבציה גבוהה לתהליך.',
  goals: 'חיזוק כלי ויסות עצמי · שיפור התפקוד היומיומי · הפחתת מצוקה.',
  challenges: 'התמודדות עם מצבי לחץ · דפוסי הימנעות · ויסות רגשי תחת עומס.',
  prep: 'המשך מעקב שבועי, עבודה על הכלים שנלמדו וחיזוק חוויות ההצלחה.',
};

export function patientOverviewDefault(patientId: string): PatientOverview {
  return patientId === 'p5' ? { ...SIMBA_OVERVIEW } : { ...DEFAULT_OVERVIEW };
}

/** Empty overview for live API mode — no seeded clinical copy. */
export const EMPTY_OVERVIEW: PatientOverview = {
  summary: '',
  goals: '',
  challenges: '',
  prep: '',
};

/** Seeded defaults offline; blank (plus local overrides) when the API is live. */
export function patientOverviewBase(patientId: string, useApi: boolean): PatientOverview {
  return useApi ? { ...EMPTY_OVERVIEW } : patientOverviewDefault(patientId);
}

export const OVERVIEW_FIELDS: { key: keyof PatientOverview; label: string }[] = [
  { key: 'summary', label: 'סיכום הטיפול הנוכחי' },
  { key: 'goals', label: 'מטרות הטיפול המרכזיות' },
  { key: 'challenges', label: 'אתגרים נוכחיים' },
  { key: 'prep', label: 'הערות לקראת הפגישה הקרובה' },
];
