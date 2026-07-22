# Demo Script — Sensei (hackathon presenter guide)

A 5-minute walkthrough hitting the product's "money moments" in order. Live app:
<https://sensei-hackathon-app.vercel.app> (or `npm run dev` → `localhost:3110`).
Reset state anytime: sign out → sign in, or clear site data.

> One-line pitch: "בין פגישה לפגישה יש למטפל דקות, לא שעות — Sensei הופך הקלטת
> פגישה לתובנות, ושם את 'מי הבא ואיך להתכונן' במבט אחד."

## 1. Sign in → the morning open (~60s) — core value

- Use the demo sign-in. Land on **דף הבית**.
- Point at: greeting + workload strip → focus zone (הפגישה הבאה · להמשך עבודה ·
  ממתינים לשיבוץ) → today's agenda with "בפרקים הקודמים" recaps.
- **Play a TTS recap** (daily or per-session) — the "prep while pouring coffee"
  moment.
- Say: "מי אני רואה היום, מה קרה בפעם הקודמת, מה דורש תשומת לב — בלי לפתוח אף
  תיק."

## 2. Simba's patient file (~90s) — the dataset, honest AI

- מטופלים → **סימבה** (the Sensei dataset patient, 5 real sessions).
- Show top-to-bottom: overview → **מהלך הטיפול** (treatment arc: ייצוב → …
  → אינטגרציה) → **ציר האמונה** (core-belief trajectory: "אני הרגתי את אבא
  שלי" → "צלק ניצל את האסון · אני הייתי ילד שרצה לשרוד").
- Open a session: summary, therapist insight, phase/protocol/distress/homework.
- Honesty point: other patients show **no fabricated arcs** — bespoke content
  only where the dataset provides it; the demo never invents clinical claims.

## 3. Upload a session (~45s) — the core flow

- העלאת פגישה → drop an audio file (mp3/wav/m4a; validation + progress) → AI
  summary, insights, risk flag appear; prep report updates.
- Note: outputs are seed-driven until a backend is wired (typed API seam is
  ready) — and the UI says so honestly.

## 4. Calendar + prep report (~45s)

- יומן: click an empty slot → prefilled dialog (conflict check, weekly
  recurrence) → drag an event to move it.
- דוח לפגישה הבאה: one-tap prep for the next patient.

## 5. Closers (~30s, pick two)

- **Mobile**: narrow the window <768px — dedicated touch shell, day strip,
  44px targets.
- **Dark mode + accessibility**: theme toggle; keyboard-only run; mention
  WCAG 2.2 AA verified in both themes (axe + contrast audit in CI).
- **Data ownership**: הגדרות → "הנתונים שלך" — export/restore JSON backup.

## If asked

- "Is it real AI?" — client-only demo; AI outputs are curated seed data; the
  service layer (`src/services/`) activates with `VITE_API_BASE_URL`.
- "RTL/Hebrew?" — Hebrew-only by design; logical-CSS-only, CI-guarded.
- "Quality?" — 491 tests, CI gates (lint · types · a11y · duplication ·
  version-consistency), deployed with immutable-asset caching.

Recovery: if anything looks stale mid-demo, hard-refresh — the app
auto-recovers from stale chunks and drafts survive interruption.
