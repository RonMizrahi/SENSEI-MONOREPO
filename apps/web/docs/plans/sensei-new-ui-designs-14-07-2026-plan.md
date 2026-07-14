# Plan — Implement the "SENSI — READY FOR PROD" designs (web + mobile) on `new-ui`

> Saved retroactively per CLAUDE.md rule 6 / plan-guidelines Phase 1. Branching
> strategy **B — current branch** (`new-ui`, a user-created side branch). One PR
> at the end (via `pr-mr-prepare`).

## Context

The user built prototypes in a Claude Design project ("SENSI — READY FOR PROD",
`7b53a63d-7b15-4cfa-bb32-d54eeb2d7f02`) and wants them implemented in the real
Sensei SPA, reusing the existing stack (React 18 + TS + Vite, no router,
`AppStore` context, vanilla CSS + tokens, Hebrew RTL). No new deps, no backend.

Reading the two design-canvas sources: the **web** prototype reused the existing
pages verbatim except a new **Google-Calendar-style week-view home**; the
**mobile** prototype is a new touch-first flow (day view → prep report → patient
→ recording + insight/attach sheets).

Confirmed decisions: (1) client-only wiring to store/services/demo data; (2)
dedicated mobile screens, viewport-gated; (3) replace the dashboard with the
calendar week view.

## Binding constraints (CI-enforced)
- Hebrew only, RTL, plural voice, **no emoji** (inline SVG icons instead).
- Colors via `var(--token)` only; **no hardcoded hex in .ts/.tsx** (ratchet 8).
- Logical CSS only; technical strings `dir="ltr"`.
- Every user-visible change → CHANGELOG + version + README badge in sync.
- Leaf modules (`utils/ data/ hooks/ nav/`) must not import `pages/ components/ store/`.

## Milestones & status

- **M0 — Foundation** `[DONE]` — session-category + `--now-line` tokens (light+dark,
  AA-verified in `tests/contrast.test.ts`); `src/hooks/useIsMobile.ts`
  (`tests/useIsMobile.test.tsx`); eslint ignores design-sync artefact dirs.
- **M1 — Desktop CalendarHome** `[DONE]` — `src/pages/DashboardPage.tsx` +
  `dashboard.css` rewritten as the week grid (now-line, category events,
  mini-month, legend, week nav, schedule dialog CTA) sourced from
  `useWeekEvents`. `tests/dashboardCalendar.test.tsx`; a11y/routing updated.
- **M2 — Mobile shell + day view** `[DONE]` — `App.tsx` viewport branch →
  `components/mobile/MobileApp.tsx`; `MobileDayView.tsx` (strip + month picker +
  expandable actions + insight/attach sheets); `icons.tsx`, `mobile.css`,
  `shared/PageFallback.tsx`. `tests/mobileDayView.test.tsx`.
- **M3 — Mobile prep/patient/recording** `[DONE]` — `MobilePrepReport.tsx`,
  `MobilePatient.tsx`, `MobileRecording.tsx` (on `useAudioRecorder`, extended
  with pause/resume); shared `data/sessionCategories.ts`, `data/reportContent.ts`.
  `tests/mobileScreens.test.tsx`.
- **M4 — Polish, a11y, CI green** `[DONE]` — `tests/mobileA11y.test.tsx` (axe);
  reduced-motion covered globally; full gate green.

## Key decisions / deviations
- **Multi-hue category colors** kept (calendar readability) but tokenized + AA-verified,
  a deliberate deviation from the app's blue-only identity — approved via the plan.
- **Emoji → SVG** and **hex → token** conversions are mandatory (CI guards), so mobile
  screens are visually faithful, not byte-identical to the prototype.
- Mobile reaches non-designed routes via the existing **Sidebar as a drawer**; the
  prototype's hardcoded roster was dropped in favor of the store's real data.
- **Pre-existing bug fixed** (user-directed): `loadPatientUpcomingEvents` no longer
  injects the generic calendar fixture into a patient's upcoming list (was a
  date-dependent off-by-one that failed `tests/patientUpcomingMeetings.test.tsx`).

## Verification results
- `npm run check` (lint + test + build): **353 tests pass**, build clean.
- Coverage (logic layer): **86.1% stmts / 81.3% branches / 73.8% funcs / 86.1% lines** (≥70%).
- Duplication (jscpd): **1.99%** (< 5%).
- Mobile + desktop axe (structural WCAG): clean.
- **Gate A** (per-file code review): 6 parallel reviewers → 8 findings fixed (see
  `docs/code-review/sensei-new-ui-14-07-2026-code-review.md`); then 3 simplifiers
  (2 tiny tidy-ups) + manual security pass (`security-review` tool not installed).
- **Gate B** (holistic diff review): **clean / merge-ready**, no Critical/Important.

### Post-review — aligned with main + backend-API parity

- **Aligned `new-ui` with `main`** (merged 7 new commits: demo API bearer token,
  live session summaries, live next-meeting report). Resolved the one conflict
  (`ReportPage.tsx`): kept main's live-API report and sourced its offline copy
  from `data/reportContent.ts` (single source, shared with the mobile prep).
- **Backend-API parity for the mobile screens** (were partly demo-only):
  `MobilePatient` → `usePatientUpcomingMeetings`; `MobileRecording` → `submitUpload`
  with the appointment's `meetingId`; `MobilePrepReport` → live report via the new
  shared `useNextMeetingReport` hook (skeleton/error/body gated like ReportPage).
  Two review rounds; all findings fixed (incl. the meetingId-required upload bug
  and the demo-as-live gating bug).
- **Gate:** lint + typecheck + **356 tests** + build green; jscpd 2.09%.
- **PR:** https://github.com/avitalg/SENSEI/pull/2 (`new-ui` → `main`) — MERGEABLE.

## QA verdict
_Phase 4 (`qa-engineer` acceptance pass on the running app) not yet run — needs
`npm run dev` + Playwright (declined earlier). Recommended before final accept._
