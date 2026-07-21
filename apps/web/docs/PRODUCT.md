# Product — Sensei Frontend (PRD · Personas · IA · Journeys)

The product source of truth for the **frontend**. Implementation details live in
[ARCHITECTURE.md](../ARCHITECTURE.md); copy rules in [CONTENT_GUIDE.md](../CONTENT_GUIDE.md);
per-topic doc map in [docs/INDEX.md](INDEX.md).

> Scope reminder: Sensei is a **client-only** production frontend (seeded demo
> data + `localStorage`). It is a production-ready *demo/design reference*, not a
> live clinical system. See README § Scope.

## 1. Product definition (PRD summary)

**Problem.** Between back-to-back sessions, a therapist has minutes — not hours —
to recall where each patient stands, prepare for the next meeting, and capture
observations before they evaporate.

**Product.** A Hebrew-only, RTL practice-management workspace that turns session
recordings into AI summaries, insights, risk flags, and prep reports — and puts
"who's next + how to prepare" one glance away.

**Core value moment.** The morning open: the home screen answers *who am I seeing
today, what happened last time, and what needs my attention* without opening a
single file.

**Non-goals.** Patient-facing features; diagnosis; backend services (transcription,
LLM analysis, RBAC, storage) — displayed via seed data until wired (PRD §10 scope).

## 2. Personas

| Persona | Needs | Served by |
|---|---|---|
| **ד"ר רותם שגב** — clinical psychologist, 20+ active patients, back-to-back days | Instant context per patient; zero-friction capture; prep in the gaps between sessions | Home focus zone + agenda recaps + TTS; quick actions on every list row; prep report |
| **מטפל/ת מתחיל/ה** — small practice, building habits | Guidance, forgiving flows, trust | First-run welcome banner → core upload flow; draft recovery; undo on delete; honest demo labeling |
| **מנהל/ת קליניקה** (secondary) | Roster hygiene over time | A–Z + search everywhere, archive with restore, permanent-delete with purge |

## 3. Information architecture

Primary navigation (sidebar, single source: `src/nav/navConfig.ts`) is grouped
"act → review → utilities" for orientation:

**Daily actions** (top, unlabelled — the default group):
1. **דף הבית** — attention-first: greeting → workload strip → focus zone (next
   session · resume drafts · needs scheduling) → calendar (week/day/month) +
   today's agenda with per-session actions & TTS recap
2. **העלאת פגישה** — the core flow (upload a session recording file → AI outputs; direct in-browser recording was removed in v1.40.0)
3. **מטופלים** — roster (search/sort) → patient file (overview · notes timeline ·
   documents · sessions · history · the dataset's treatment arc "מהלך הטיפול" +
   core-belief trajectory "ציר האמונה", honesty-gated to bespoke content)
4. **יומן** — full calendar; create/edit/drag sessions in place

**מעקב ותיעוד** (records & tracking — review-oriented, lower frequency):
5. **דוח לפגישה הבאה** — prep report
6. **היסטוריית פגישות** — all-patients directory → shared SessionHistoryView
7. **ארכיון מטופלים** — read-mostly files, restore / permanent delete

**כללי** (pinned utilities): עזרה ותמיכה · הגדרות (פרופיל · ערכת נושא · נגישות ·
"הנתונים שלך" — ייצוא ושחזור; הגדרות is pinned as the FINAL menu item)

Cross-cutting: ⌘K command palette, global search, AI assistant, notifications.
Deep links: every screen is hash-addressable (`#/patient/p3`); a URL sets the
route only — it can never bypass sign-in (`src/nav/urlHash.ts`).

**Mobile navigation** (< 768px): a fixed **bottom tab bar** (`MobileTabBar`)
surfaces the primary daily-action group in the thumb zone; the header hamburger
opens the full nav drawer (records/tracking + pinned utilities). Both derive
from the same navConfig SSOT — nothing is mobile-only or duplicated.

### Navigation governance (how the IA scales)

One rule keeps the nav from sprawling: **navConfig is the single source of
truth** — the sidebar, ⌘K palette, global search, and the mobile bottom bar all
derive from it, so a destination is added *once*. Where a new feature goes:

- **A frequent, daily-action destination** → the primary (unlabelled) group. It
  automatically joins the mobile bottom bar (which takes everything before the
  first section). Keep this group to ~4–5 so the bottom bar stays thumb-usable.
- **A review/records/reference destination** → the **מעקב ותיעוד** group.
- **A low-frequency utility or preference** → the pinned **כללי** group
  (Settings stays the final item).
- **A patient- or session-scoped action** (report, transcript, letter) → *not*
  a nav destination; reach it contextually from the patient file / session and
  via deep link. These are the `CONTEXTUAL` routes in `navConfig.test.ts`.

Adding a top-level route without a navConfig entry fails the "no orphaned
routes" guard; adding a destination without a distinct icon/label/title fails
the destination guards. Growth is therefore additive and structurally checked.

## 4. Key user journeys

**J1 — Morning open (core value).** Sign in → home greeting + workload strip →
scan today's agenda ("בפרקים הקודמים" recap per patient; optional TTS daily or
per-session playback) → one-tap prep report for the first patient.

**J2 — After a session.** Home/patient file → העלאת הקלטה → upload (validated
mp3/wav/m4a, progress, offline queue) → AI summary + insights + risk flag →
prep report updated for next time.

**J3 — Between sessions.** Patient file → הוספת הערה → dated note appended to the
timeline (draft-protected: an interrupted note survives and offers recovery —
also surfaced on the home "להמשך עבודה" card).

**J4 — Scheduling.** Calendar (or empty-slot click, prefilled) → one dialog:
patient, date/time (conflict check with override), duration, optional weekly
recurrence ×4/×8 → drag-and-drop to move; edit in place from the event dialog.

**J5 — Roster lifecycle.** Create patient (validated; soft duplicate warning that
never blocks) → treat → archive (undoable) → restore, or permanent delete
(confirmation + full reference purge — no orphaned data).

**J6 — Data ownership.** Settings › Profile › "הנתונים שלך": export the full
locally-persisted record as a dated JSON backup, and restore it (validated file →
explicit replace-all confirmation → rehydrate through the normal startup path).
Export + restore together also serve as device-to-device transfer — the closest a
client-only build gets to sync.

## 5. Screen inventory

The authoritative screen list is the route map in `src/nav/navConfig.ts` +
`src/pages/` (one lazy file per route). The hackathon screen spec (5 screens,
17.7) is fully implemented, including its acceptance criteria; where the spec
left open questions, the shipped answers are recorded in [ADR.md](ADR.md).

Mobile (<768px) renders a dedicated touch shell (`src/components/mobile/`):
day-strip home with per-appointment quick actions (insight · attach); other
routes fall back to the shared responsive pages. Same store, same data.

## 6. Success measures (frontend-observable)

- Time-to-context: home answers "who/when/what happened" with zero navigation.
- Zero data loss: drafts survive interruption; deletes are undoable or confirmed.
- Task completion without dead ends: every empty state offers the next action.
