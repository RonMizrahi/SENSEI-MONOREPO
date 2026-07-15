# Plan — Mock-UI Parity in Real Front + Backend

**Date:** 15-07-2026 · **Owner:** Ron Mizrahi + Claude · **Status:** IN PROGRESS

## Goal

Make the running app show the **same Hebrew world the SPA mock shows, but sourced
from the real backend**. Two parts:
1. **Fill the data** — seed every mock entity into Postgres via migration scripts.
2. **Close the API gaps** — where a screen has no endpoint to fetch its data, build
   the endpoint and wire the SPA to it (replace the localStorage/seed fallback).

End state: with `VITE_API_BASE_URL` set, every mock screen renders from the DB.

## Decisions (locked with the user, 15-07-2026)

- **Scope: FULL parity** — clinical data (patients, calendar, sessions, summaries,
  transcripts, insights, next-meeting reports, notifications) **+** therapist
  profile/settings, clinical notes, and letters. **Documents are out** (the mock has
  no document/resource entity — only inline notification text).
- **Demo therapist is seeded, dev-only gated** — `ד״ר רותם שגב` / `demo1234` at the
  fixed UUID `00000000-0000-4000-8000-000000000001`, so the SPA's auto-login owns all
  therapist-scoped seed data. Seed inserts are **guarded so they no-op outside dev**
  (see "Seed gating" below). This consciously reverses the earlier "no credential"
  decision because the goal requires the SPA to fetch scoped data.
- **Branching: Strategy A (single feature branch)** — merge PR #11 → main, branch
  `mock-parity/full-backend` off main, all milestones commit onto it, **one PR at the
  end**. QA runs on the assembled branch before that PR merges.

## Key architectural facts (from the three-agent codebase map)

- **Most mock "data" is derived, not stored.** Only 4 patients, 8 appointments, 9
  notifications, 1 profile are literal. Sessions/summaries/transcripts/insights/reports/
  letters are **generated at runtime** from shared Hebrew template arrays indexed by
  session position. Seeding = *materializing* those generators into rows.
- **Wire contract is snake_case**, unversioned routes — the SPA is the spec. Honor:
  `created_at, start_at, end_at, patient_id, therapist_id, meeting_id, transcript_id,
  full_name, access_token, open_topics, source_meeting_ids, last_summary_excerpt,
  generated_at`; queries `from/to/time_zone/archived`.
- **Global JWT guard.** Every data route needs a Bearer token; the SPA auto-logs-in as
  the demo therapist (`apiAuth.ensureDemoApiAuth`: probe → register(200/409 ok) → token
  with `demo1234`). So the seed therapist's password MUST be `demo1234` and its UUID
  fixed, or the SPA logs in as a different user and sees none of the seed.
- **Module pattern to copy:** `src/patients/` — controller (dispatch) → service (logic)
  → repository behind an injection token + contract interface, plus a mock repository,
  DTOs (class-validator + `@ApiProperty`), constants. `provideMockSwappable` swaps real/
  mock by `MOCK_MODE`. New table = next sequential `db/migrations/000N_*.sql` + entity +
  module registered in `app.module.ts` + `.spec.ts` beside each unit.

## Seed gating (dev-only seed mechanism)

Seeds live in the numbered migration chain (tracked in `_migrations`, identical across
envs) but their **inserts are guarded** so production stays clean:

- New config `SEED_DEMO_DATA` (Zod env, default `false`; `true` in dev `.env`/`.env.example`).
- The **migration runner** issues `SET LOCAL app.seed_demo = '<flag>'` at the start of
  each migration transaction (from `ConfigService`).
- Every demo-seed migration guards inserts with
  `WHERE current_setting('app.seed_demo', true) = 'true'` (or wraps them in a `DO`/
  `INSERT ... SELECT ... WHERE`). In prod (`SEED_DEMO_DATA=false`) the file still applies
  and is tracked, but inserts **0 rows**. This keeps `_migrations` equal across envs (so
  `db.int-spec` exact-equality holds) while never shipping demo rows/credentials to prod.

## Milestones

Every milestone: implement on the feature branch → unit + integration tests
(`testing-standards`) → **run `code-quality-pipeline`** → update this plan file. No MR
until the end (Strategy A); QA + close-out happen in M6.

---

### M1 — Foundation: seed gating + demo identity + calendar parity
**Goal:** the SPA logs in as the seeded therapist and shows real patients + calendar.
Steps:
1. Merge PR #11 → main; branch `mock-parity/full-backend` off main.
2. Add `SEED_DEMO_DATA` to `config/env.schema.ts` (+ `.env.example`, dev `.env`).
3. Migration runner: `SET LOCAL app.seed_demo` from config per migration txn.
4. `0004_seed_demo_identity.sql` (guarded): seed demo therapist (fixed UUID, argon2id
   hash of `demo1234`, `role=therapist`, `auth_type=password`) + 8 `calendar_events`
   matching `buildMockScheduledAppts` (Israel-time, `CURRENT_DATE + dayOffset`, dur 50,
   scoped to therapist, `patient_id` → p1–p4).
5. Tests: int-spec (SEED_DEMO_DATA on → therapist + 8 events present & therapist-scoped;
   off → none); update `EXPECTED_MIGRATIONS` for `0004`; unit test the runner GUC set.
6. **code-quality-pipeline.**
Verify: SPA (VITE set) → Dashboard/Calendar/Patients render from DB; login is transparent.

### M2 — Sessions, summaries, transcripts, insights (materialize + transcript read API)
**Goal:** past-session screens (MeetingHistory, SessionDetail, Summary, Transcript)
render real rows.
Steps:
1. `0005_meeting_summary_insight.sql`: `ALTER meeting_summaries ADD insight text`.
2. `0006_calendar_patient_filter` (if needed): add `patient_id` filter to `GET /calendar`
   list query (therapist-scoped) so MeetingHistory can fetch a patient's past sessions.
3. `0007_seed_demo_sessions.sql` (guarded): per patient, materialize N past
   `calendar_events` (N = `demoSessionCount(id)`, dates from `SESSION_DATES`), each with a
   `meeting_summaries` row (`status=ready`, `text`=`sessionSummaries[i%8]`, `insight`=
   `INSIGHTS[i%8]`, `model='demo'`) and a `transcripts` row (`diarized_segments` = the
   `TRANSCRIPT_EXCERPTS[i%8]` speaker/text lines, `language='he'`). Duration/risk per rules.
4. New endpoint `GET /meetings/:meetingId/transcript` (new `transcripts` module: controller/
   service/repo/mock/dto) → `{ meeting_id, language, raw_text, segments:[{speaker,text}] }`.
5. Extend `SummaryResponseDto` with `insight`.
6. Wire SPA: MeetingHistory (fetch patient past events + summaries), SessionDetail
   (summary+insight+transcript), Transcript (fetch via new endpoint), Summary (add insight).
7. Tests (unit + int for transcript endpoint, patient filter, seed) + **pipeline.**

### M3 — Notifications (new table + module + wiring)
Steps:
1. `0008_notifications.sql`: `notifications(id, therapist_id fk, kind, patient_id fk null,
   title, body, group_label, display_time, read_at, archived_at, created_at)`.
2. `0009_seed_demo_notifications.sql` (guarded): seed the 9 `NOTIFS` (p5 orphan → `patient_id
   NULL`, name kept in body; seed `read_at`/`archived_at` from `notifRead`/`notifArchived`).
3. New `notifications` module: `GET /notifications` (therapist-scoped; supports filter/group),
   `PATCH /notifications/:id` (mark read / archive).
4. Wire NotificationsPage + read/archive state to the API (replace `data/catalogs` NOTIFS).
5. Tests + **pipeline.**

### M4 — Therapist profile + settings (extend users + settings + endpoints + wiring)
Steps:
1. `0010_user_profile_settings.sql`: `ALTER users ADD phone, gender, title, license_number,
   org, bio, avatar_color`; `CREATE user_settings(user_id pk fk, a11y jsonb, notif_prefs jsonb,
   appearance jsonb, security jsonb)`.
2. `0011_seed_demo_profile.sql` (guarded): backfill the seeded therapist's profile fields +
   insert `user_settings` from the mock (`a11y`, `notifPrefs`, theme, security blobs).
3. Endpoints: `GET/PATCH /auth/me` (profile), `GET/PUT /settings` (preferences).
4. Wire ProfileTab + SettingsPage (profile, a11y, appearance, notifPrefs, security).
5. Tests + **pipeline.**

### M5 — Next-meeting reports + clinical notes + letters
Steps:
1. `0012_patient_report_questions.sql`: `ALTER patient_reports ADD questions jsonb DEFAULT '[]'`;
   extend `NextMeetingReportDto` with `questions`.
2. `0013_patient_notes.sql`: `patient_notes(therapist_id, patient_id, body, updated_at)`
   (per-therapist note; the `notesOverrides` home). Endpoint `GET/PUT /patients/:id/notes`.
3. `0014_letters.sql`: `letters(id, therapist_id, patient_id, body, created_at)` + module
   (`GET/POST/PATCH /patients/:id/letters` or `/letters`).
4. `0015_seed_demo_reports_notes_letters.sql` (guarded): seed `patient_reports` (intro/
   changes/open_topics/questions from `reportContent`), a default clinical note per patient,
   and the demo letter body.
5. Wire ReportPage (questions), PatientPage/LetterPage (notes + letter persistence).
6. Tests + **pipeline.**

### M6 — Integration, QA handover, close-out
1. Assemble the branch; run the full app against a real DB (local Postgres or the dev
   Supabase) with `SEED_DEMO_DATA=true`; smoke every screen through the SPA.
2. **QA handover** to `qa-engineer` (handoff bundle: this plan, changed endpoints/screens,
   run/reach/auth/seed, two identities for IDOR probing). Gate on the verdict.
3. Close-out: update this plan's statuses + decisions + verification; update root
   `CLAUDE.md` (new modules/tables/commands); run `claude-md-improver`.
4. Open the single PR (`pr-mr-prepare`) → main.

## Out of scope (kept client-side, by decision)
- Documents/resources (no mock entity), dashboard analytics (client-computed from
  calendar), keyboard shortcuts, AI-assistant seed message, session-category lookup
  (derived from title keywords). These stay in the SPA; note in CLAUDE.md.

## Risks / watch-items
- **Seed gating correctness** — verify prod (`SEED_DEMO_DATA=false`) inserts 0 rows while
  `_migrations` stays equal across envs (protects `db.int-spec` exact-equality).
- **Therapist scoping (IDOR)** — every new therapist-scoped table/endpoint scopes by
  `@CurrentUser().userId` and 404s non-owners. New negative tests per endpoint.
- **snake_case drift** — new DTOs must match what `src/services/*` sends/expects exactly.
- **Materialized session dates** are relative to seed-apply date; re-seeding re-anchors.
- **patients stay global** (no `therapist_id`) — fine for single-therapist demo; notes are
  therapist-scoped via `patient_notes`.

## Status

| Milestone | Status | Notes |
|---|---|---|
| M1 Foundation (gating + identity + calendar) | DONE | SEED_DEMO_DATA + GUC-gated runner (`set_config(is_local)`), 0004 seeds therapist + 8 appts. Gate A passed (3 reviewers clean, security clean). 386 unit + 95 int green. |
| M2 Sessions/summaries/transcripts/insights | BACKEND DONE | 0005 insight + 0006 seed (31 sessions) + GET /meetings/:id/transcript. 389 unit + 97 int green, live on Supabase. FE wiring → consolidated pass (see note). |
| M3 Notifications | BACKEND DONE | notifications table + module + 9 seeded; GET/PATCH. Live on Supabase. |
| M4 Profile + settings | BACKEND DONE | users profile cols + user_settings; GET/PATCH /auth/me + GET/PUT /settings; seeded. Live. |
| M5 Reports + notes + letters | BACKEND DONE | patient_reports.questions + seed; patient_notes + GET/PUT + seed. Letters = derived (no table). Live. |
| M-FE Consolidated SPA wiring | MOSTLY DONE | Wired to live API: report questions, notification center (read/archived via PATCH), clinical notes (patient + letter), therapist profile. Full service layer (transcripts/notifications/profile/settings/notes) + summary `insight`/report `questions` fields. web 1.2.0, 368 tests + build green. **Deferred:** SessionDetail/Transcript (needs the SPA's local sessions mapped to real meeting ids) and settings-prefs sync (theme/a11y equal SPA defaults → no visible change) — services already in place. |
| M6 Integration + QA + close-out | IN PROGRESS | Backend live-verified on Supabase throughout; root CLAUDE.md updated; single PR. QA (qa-engineer) + Gate B recommended as the acceptance gate. |

**Backend complete (M1–M5):** all APIs + gated seeds land migrations 0004–0012; 401 unit
+ 103 integration green; every endpoint live-verified against the dev Supabase. Remaining:
the consolidated frontend wiring (M-FE) + close-out/QA (M6).

**Execution note (15-07-2026):** to avoid repeated React-skill context switches, the
per-milestone SPA wiring is batched into ONE consolidated frontend pass ("M-FE") after
the backend APIs (M2–M5) land. Each backend milestone still ships with its own tests +
Gate A; M-FE wires all new endpoints (transcript, notifications, profile/settings, notes,
letters, session detail) to the SPA at once, under `front-react-development` +
`apps/web/CLAUDE.md`, then M6 runs integration + QA on the assembled system.
