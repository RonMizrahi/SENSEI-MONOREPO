# Changelog — Sensei React App

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] — 2026-07-15

### Added — live backend wiring (mock-parity)

The `src/services/` API layer now connects to the Sensei backend when
`VITE_API_BASE_URL` is set — the standalone demo experience (seed data +
localStorage) is unchanged when it is unset. New/extended clients: transcripts,
notifications, profile, settings, and clinical notes; the summary carries an
`insight` field and the report carries `questions`.

- **Report suggested questions** come from the live next-meeting report (falls
  back to the demo copy when the report has none).
- **Notification center** sources its feed from `GET /notifications`, with
  read/archived driven by the API and persisted via `PATCH` (optimistic).
- **Clinical notes** load from and save to `/patients/:id/notes`, so both the
  patient page and the generated letter reflect the stored note.
- **Therapist profile** loads from and saves to `/auth/me`.
- **Restored sessions acquire a live API token** on boot when the backend is
  wired (previously only demo-mode did), so a persisted session sources real data
  instead of silently falling back to the demo copy.

Session-detail / transcript wiring (which needs the SPA's locally-generated
sessions mapped to real meeting ids) is tracked as a follow-up; the backend
transcript endpoint + client are already in place.

## [1.1.0] — 2026-07-14

### Added — calendar week-view home + mobile-experience foundation (new-ui)

Implements the "SENSI — READY FOR PROD" designs, reusing the existing stack (no
new dependencies, no backend): a redesigned home and the groundwork for a
dedicated mobile experience.

- **New home — Google-Calendar-style week view.** The dashboard's stat list is
  replaced by a full week grid: 7 day columns over an 08:00–19:00 hour gutter,
  a live "now" line on today's column, colour-coded session-type event blocks, a
  mini-month, a category legend, week navigation + "today", and a "new meeting"
  CTA that opens the existing schedule dialog. Events come from the same source
  as the calendar (`loadCalendarEvents` — demo fixture now, senseiapi `/calendar`
  when configured) merged with locally-scheduled appointments, so it stays in
  sync with the rest of the app and lights up automatically with a real backend.
  Every control is a native, keyboard-operable button. Guarded by
  `tests/dashboardCalendar.test.tsx` (events render, week nav + today drive the
  range heading) and the updated a11y/routing suites.
- **Session-category colour tokens.** Added five week-view swatches
  (`--cat-*-bg/bar/text`) plus a `--now-line` indicator to `styles/tokens.css`
  in both light and dark themes; every text-on-swatch pair is AA-verified in
  `tests/contrast.test.ts`. No hardcoded hex enters components.
- **Dedicated mobile experience — shell + day view.** Below 768px the app now
  renders a touch-first shell (`MobileApp`) instead of the desktop layout: a
  compact header, the existing sidebar reused as a slide-in drawer, and the
  global Snackbar/Dialogs. The home is a **mobile day view** — a horizontal
  14-day strip with a month picker over a per-day appointment list; each
  appointment expands to quick actions (insight / attach / record) and a
  "prepare for next meeting" CTA, with insight/attach as bottom-sheets and
  confirmations via the store toast. Appointments come from the same
  `useWeekEvents` source as the desktop week view. Routes without a bespoke
  mobile screen render the shared page in a narrow wrapper. Guarded by
  `tests/mobileDayView.test.tsx`.
- **Mobile prep report, patient profile, and recording.** The mobile flow is
  complete: the day view's "prepare" CTA opens a **mobile prep report**
  (previous-session summary, follow-up points, checkable goals, AI insight —
  the same data as the desktop `ReportPage`); appointments/prep open a **mobile
  patient profile** (avatar, contact, next meeting, recent sessions); and the
  record action opens a full-screen **recording overlay** (elapsed timer,
  animated waveform, pause/resume/stop/cancel) built on the existing
  `useAudioRecorder` hook — now extended with pause/resume. Guarded by
  `tests/mobileScreens.test.tsx`.
- **`useIsMobile` viewport hook** (`src/hooks/useIsMobile.ts`) gates desktop vs
  mobile; **`useWeekEvents`** centralizes week-event loading for both shells;
  **`data/sessionCategories.ts`** and **`data/reportContent.ts`** are the single
  sources for category/prep content shared by desktop and mobile. All emoji-free
  (inline SVG icons), tokens-only, RTL-logical. Unit-tested
  (`tests/useIsMobile.test.tsx`).
- **Tooling:** eslint now ignores the gitignored design-sync artefact/tooling
  directories (`ds-bundle`, `.ds-sync`, `.design-sync`) so local lint matches CI.

### Fixed

- **Patient "upcoming meetings" no longer leak generic calendar-demo events.**
  In demo mode `loadPatientUpcomingEvents` injected the weekly calendar-view
  fixture into a specific patient's list, so same-named generic slots
  (e.g. a "דנה לוי" fixture meeting) surfaced as that patient's real upcoming
  appointments — and, worse, the set that was still "upcoming" depended on the
  current date, making the list (and `tests/patientUpcomingMeetings.test.tsx`)
  date-dependent. A patient's upcoming meetings now come only from their own
  scheduled appointments (matching API mode); the generic fixture stays where it
  belongs — the calendar view.

### Changed

- **Mobile screens use the same API paths as the desktop pages** (so they light
  up with a real backend, not demo-only):
  - `MobilePatient`'s next meeting reads the API-aware `usePatientUpcomingMeetings`
    hook (was client-only `scheduledAppts`), matching `PatientPage`.
  - `MobilePrepReport` now shows the **live next-meeting report** (polled from
    senseiapi via the new shared `useNextMeetingReport` hook) when configured,
    falling back to the shared demo copy — parity with the desktop `ReportPage`.
  - `MobileRecording` hands the captured file to `submitUpload`
    (senseiapi `/audio/upload`) when configured, attaching the appointment's
    calendar meeting id (threaded from the day view) as `meetingId` — the same
    contract `UploadPage` requires; a record action with no linked meeting, or
    demo mode, stays a toast-only confirmation.
  - Calendar data on both new shells already flowed through `loadCalendarEvents`
    (fixture now, API when configured).

- **Prep report (`ReportPage` + mobile) realigned to the agreed structure**:
  patient card now carries a "מעבר לתיק מטופל" quick action + a labelled phone;
  sections are סקירה מהירה → תקציר קולי → **סיכום הפגישה הקודמת** → **נקודות
  למעקב** → **מטרות לפגישה הקרובה** → **שאלות מוצעות למפגש**. The live-report
  fields map onto the new labels (intro / last_summary_excerpt / changes /
  open_topics); suggested questions are demo-only (`REPORT_QUESTIONS`), hidden
  once a live backend report is shown. The mobile prep report gained a "סקירה
  מהירה" card and the questions section, dropping the redundant insight card.

## [1.0.80] — 2026-07-06

### Added — clinical-notes draft recovery (parity with the summary editor)

- Extends the work-recovery protection from 1.0.77 to the product's other clinical editor: a
  therapist editing a patient's **clinical notes** who is interrupted — a notification, the command
  palette, any navigation — no longer loses the text. `navigate()` reset `editingNotes` on every
  route change and the in-progress note wasn't persisted, so it vanished silently (the same gap the
  summary editor had). In-progress notes are now auto-captured per patient (`S.notesDrafts[id]`,
  persisted); on return a calm recovery banner ("יש טיוטה שלא נשמרה · להמשיך?") offers **המשך עריכה**
  or **מחיקת הטיוטה**. Cleared on save/cancel/discard; an empty draft never triggers it. The pattern
  and copy mirror the summary editor exactly, so the two clinical editors now behave identically.
- Verified live end-to-end (type note → navigate away → return → banner → resume → save → draft
  cleared, note persisted) and on mobile 375px (banner wraps, zero overflow). Guarded by
  `tests/notesDraftRecovery.test.tsx` (capture, survive-interruption, resume, discard, no-phantom-
  after-cancel).
- This was the #1 item from the prior review's recommendation report — highest value, lowest
  complexity, extends an existing pattern, zero new dependencies. Suite: 52 files, 388 tests.

## [1.0.79] — 2026-07-06

### Changed — design-system consistency: elevation is now single-sourced (SSOT)

- `CARD_SHADOW` (the standard card elevation) already existed as a canonical constant in
  `utils/styles.ts` and was correctly imported by 8 files — but the exact same shadow literal was
  **inlined 31 times across 12 other page files**. Change the elevation once and 31 places would
  drift. All 31 now use the `CARD_SHADOW` constant (imports added where missing). Zero visual change
  (identical value — live-verified the computed box-shadow is byte-for-byte the same); pure
  design-system-consistency / single-source-of-truth win. No behavioral change.
- This is the "review and fix design-system consistency" portion of the request. The feature-idea
  portion is delivered as an advisory recommendation report (not built) — the standing guardrail is
  no speculative features / no bloat; recommendations are prioritized by impact vs complexity.
- Suite: 51 files, 384 tests (unchanged — a pure refactor guarded by the existing route-render and
  canonical suites).

## [1.0.78] — 2026-07-06

### Changed — consolidated duplicated task-priority mapping (SSOT); bug audit found forms robust

- **Duplication removed:** the task-priority label/color mapping (דחוף/בינוני/נמוך → tokens) was
  defined twice — a function in `TasksPage` and an object with different key names (`l/c/b`) in
  `SearchPage` — a genuine single-source-of-truth violation. Both now call one canonical
  `priorityMeta()` in `src/utils` (mirroring `riskMeta`), SSOT-mapped in ARCHITECTURE.md. No visual
  or behavioral change; verified live that all task-priority chips render identically on both the
  Tasks screen and in global search.
- **Bug audit — the forms and interactions came back robust, verified not assumed:** the search
  highlighter uses `indexOf`, not `RegExp`, so regex-special input (`(([*`) can't crash it
  (live-confirmed); the age field sanitizes to digits-only (`replace(/\D/g,'')`, max 3) at the
  input layer, so decimals/letters/overflow are impossible before validation even runs; name
  validation rejects whitespace-only; no `new RegExp` is ever built from user input anywhere in the
  codebase. No functional defects found in this pass.
- Suite: 51 files, 384 tests (new: `priorityMeta` unit coverage incl. the unknown→low fallback).

## [1.0.77] — 2026-07-06

### Added — clinical summary draft recovery (never lose in-progress work)

- **The gap:** a therapist editing an AI session summary who was interrupted — a notification, the
  command palette, any navigation — lost their edit silently. `editingSummary`/`summaryDraft` were
  transient and `navigate()` explicitly resets `editingSummary:false` on every route change, so the
  in-progress clinical wording vanished with no warning and no recovery. This is the highest-stakes
  work-loss path in the product and it directly violated the "never lose unsaved work" principle.
- **The fix (calm, not intrusive):** in-progress edits are now auto-captured per patient
  (`S.summaryDrafts[id]`, persisted). An interruption no longer loses anything — on return, a quiet
  recovery banner ("יש טיוטה שלא נשמרה מעריכה קודמת · להמשיך?") offers **המשך עריכה** or
  **מחיקת הטיוטה**. No blocking dialog, no forced modal — the therapist stays in control. The draft
  is cleared on save, on cancel, or on explicit discard; an empty draft never triggers the banner.
- Verified live end-to-end (type → navigate away → return → banner → resume → save → draft cleared,
  edit persisted) and on mobile 375px (banner wraps, zero overflow). Guarded by
  `tests/summaryDraftRecovery.test.tsx` (capture, survive-interruption, resume, discard, and the
  no-phantom-after-cancel case).
- Broader UX-completeness review, reported honestly: onboarding skip (persisted dismissal) + resume
  (progress derived from real actions, 1.0.73), preference persistence (theme, accessibility,
  notifications, Moment), and responsive layouts (375/768/1366) were verified already-solid in
  prior passes; the summary editor was the one genuine work-recovery gap. Suite: 51 files, 383 tests.

## [1.0.76] — 2026-07-06

### Improved — analytics charts are now legible to screen readers (a11y)

- Audit finding, evidence-based: the accessibility tree showed the three analytics charts
  (פגישות לאורך זמן, התפלגות רמות סיכון, נושאים נפוצים) exposing a loose run of numbers with no
  framing — a screen-reader user navigating by heading heard bare digits, not a chart. Each chart
  is now a `role="img"` with a data-derived Hebrew `aria-label` summarizing it in one sentence
  (e.g. "מספר פגישות מעובדות לפי שבוע, במגמת עלייה: 22, 28, …"), so assistive tech gets a coherent
  announcement. The risk summary tracks the live patient mix (not a hardcoded string).
- Decorative KPI icons on the analytics page are now `aria-hidden` — they no longer surface as
  meaningless unnamed "graphic" nodes. **Zero purely-visual change**: bars, cards, colors and
  layout render identically (screenshot-verified); the blue-only palette, RTL, and design system
  are untouched.
- Scope kept honest and proportionate: this fixes the charts actually audited. A wider gap remains
  — ~169 decorative inline SVGs across the app lack `aria-hidden` — but a blind sweep is unsafe
  (some icons are the sole accessible name of icon-only buttons; hiding those would strip the
  name), so that's flagged for a dedicated shared-Icon-component pass, not a risky mass edit.
- Suite: 50 files, 379 tests (new: `tests/analyticsChartsA11y.test.tsx` — chart summaries present,
  data-bearing, and in sync with the seeded mix). Live-verified on the running build.

## [1.0.75] — 2026-07-06

### Improved — Tasks screen management flows (verified pass + four real gaps closed)

- Audit verdict first: sorting (overdue→today→upcoming, priority within), counted filters,
  undo-able delete, accessible checkbox rows, the composer, and responsive wrapping were already
  solid. Four genuine gaps fixed:
  - **Inline rename** — a pencil on every open task edits the text in place (Enter/blur saves,
    Escape cancels without bubbling to the global cascade). Renaming no longer means
    delete-and-recreate.
  - **Composer feedback** — adding with an empty description used to be a silent no-op; it now
    gives gentle guidance ("הזינו תיאור משימה") and returns focus to the field.
  - **Accessible filter state** — the filter chips are explicit buttons (role, tabIndex, keyboard
    activation) with `aria-pressed`, so assistive tech hears which view is active. Caught and
    shaped by the axe suite: `aria-pressed` on a bare link was invalid; explicit semantics beat
    relying on the runtime promotion engine.
  - **Contextual empty states** — the single "כל הכבוד, אין משימות פתוחות" message was wrong for
    the done filter (nothing completed ≠ praise) and unhelpful for new users. Now: first-run
    points at the composer, an empty done filter explains what will appear, and an empty
    filtered view offers one-click "הצגת כל המשימות".
- Suite: 49 files, 377 tests (7 new: rename save/cancel, composer guidance, aria-pressed,
  all three empty-state variants).

## [1.0.74] — 2026-07-06

### Added — "רגע בשבילי" v2: the curated wellbeing library (therapist-feedback P2)

- The between-session pause now opens on a **quiet chooser of four curated activities** (small on
  purpose — calm over choice overload): נשימה שקטה (30 שניות / דקה / 3 דקות, persisted preference),
  תרגיל קרקוע 5-4-3-2-1 (staged sense prompts, aria-live), הרהור שקט (original Japanese-inspired
  reflections rotating daily + silent countdown), and מתיחה ומים (gentle body reminder). Last-used
  activity is remembered. Every screen keeps the binding constraints: early finish, backdrop, and
  the Escape cascade always exit; no gamification, no pressure, no patient data anywhere in the
  experience (test-asserted).
- **Three levels of control on the suggestion card**, per the feedback spec: התחלת הפסקה ·
  מאוחר יותר (snoozes this visit only — deliberately NOT persisted) · hide (persisted, reversible
  in Settings → notifications, whose copy now reflects the library).
- Honest scope decisions, documented rather than faked: trigger detection stays deterministic and
  user-controlled — simulating "AI emotional-intensity" signals without a real model would be
  feature theater; ambient/nature sounds need audio assets that don't exist; analytics
  infrastructure doesn't exist in this client-only build (nothing to instrument). The
  handwritten-notes OCR future capability got its integration points documented in
  ARCHITECTURE.md (upload surface → services seam → notes destination) — extension without
  restructuring, exactly as the feedback requires.
- Suite: 48 files, 370 tests (v2 arcs: chooser, durations, grounding steps, snooze-vs-dismiss
  semantics, privacy assertion). Browser-visual spot-check deferred this turn — the session's
  preview-server slots were exhausted by parallel chats; behavior is fully covered in jsdom and
  the card reuses the wrap layout verified at 375px in 1.0.68.

## [1.0.73] — 2026-07-06

### Fixed — onboarding now acknowledges the user's first success (E2E UX + bug audit pass)

- **The getting-started checklist was lying.** Steps 3 ("העלאת הקלטה") and 4 ("אישור סיכום AI")
  were hardcoded "not done": a user who followed the checklist and completed both actions stayed at
  "2 מתוך 4 הושלמו" forever — a broken feedback loop at the exact moment of first success, the
  highest-impact finding of the jobs-to-be-done review. Steps 3–4 are now DERIVED from real state:
  a completed upload records a persisted `hasUploaded` milestone, and step 4 reads the existing
  `summaryApproved` map. Progress and the completion bar update the moment each job is done.
- TDD (proven red first) in `tests/onboardingProgress.test.tsx`: approval → "3 מתוך 4", both →
  "4 מתוך 4", and a real simulated upload sets the persisted flag. Verified live end-to-end as a
  user: upload → dashboard shows 3/4 → approve the AI summary → 4/4.
- The rest of the bundle re-verified against existing coverage, honestly: responsiveness swept at
  375/768/1366 (1.0.70), navigation/IA + flows behavior-tested (routing, palette, pager, dialogs,
  merge, auth), copy/a11y/cognitive-load audits at saturation (1.0.72), bug sweep = full suite +
  live console census clean. Suite: 48 files, 367 tests.

## [1.0.72] — 2026-07-06

### Fixed — UX/UI/copy/a11y optimization pass (post-blue-remap color-independence audit)

- The pass's new angle: after 1.0.69 collapsed four semantic hues into blue depths, every UI spot
  that differentiated states was re-audited for **color-independence**. Verified carrying non-color
  signals already: task priorities (labeled chips דחוף/בינוני/נמוך), outcome trends (directional
  arrows + magnitude), analytics deltas (+/− signs), risk levels (Hebrew labels), overdue dates
  (weight + the date text itself). One real gap found and fixed:
- **Unread messages were a colored dot alone** — silent to screen readers (WCAG 1.4.1 / 4.1.2) and
  typographically identical to read rows. The indicator now carries an accessible label ("הודעה
  שלא נקראה") and unread previews render heavier (600) in stronger text color; opening the
  conversation clears both. Guarded by `tests/messagesUnread.test.tsx` and verified live.
- **Friction walkthroughs** (live): add-task is type + one click with the composer clearing itself;
  messages open-and-mark-read is one click; core flows (upload cancel/retry, auth journeys, summary
  approve, merge) are covered by their dedicated suites. Copy, contrast, keyboard operability,
  touch targets, focus states and empty/error/loading states were each verified by the dedicated
  audits of 1.0.62–1.0.71 and their CI guards — re-run green here (47 files, 364 tests); no further
  defects found. Saturation declared honestly rather than churning stable surfaces.

## [1.0.71] — 2026-07-06

### Added — Hebrew-native regression guards + one real leak fixed (pre-launch gate pass)

- **New guard suite `tests/hebrewNative.test.tsx` (29 tests, TDD red→green):** pins `lang="he"` +
  `dir="rtl"` on the document, and renders every route (23) plus all five auth screens asserting
  **no unintended Latin text** — any English string outside a reviewed allowlist (clinical
  acronyms/instruments like PHQ-9/EDE-Q/Y-BOCS, brand terms, keyboard keys in `<kbd>`, technical
  strings like emails/IDs) fails CI. This is the missing localization regression net: an
  untranslated "Submit" anywhere now breaks the build.
- **The census found exactly one real leak** in the whole application: the referral letter's footer
  said "AI-assisted" — now "בסיוע AI". Everything else Latin on screen is sanctioned terminology.
- **Pre-launch gate re-verified:** build/typecheck/lint/tests green (46 files / 363 tests, incl.
  both-theme contrast, axe, RTL/copy guards, auth flows, stale-chunk recovery); zero console errors
  across all 23 routes measured with an in-page error hook on a clean session (earlier buffered
  errors were HMR artifacts from the edit session itself, proven stale by module timestamps); no
  placeholder/demo-leak content (demo data is the product's labeled purpose); routes/deep links,
  responsive 375/768/1366 and touch targets verified in the preceding releases. Frontend release
  decision: READY FOR PRODUCTION (as a client-only demo/design reference — its stated scope).

## [1.0.70] — 2026-07-06

### Added / Fixed — cross-device audit, dedup pass, stale-deploy recovery

- **Stale-client recovery (deploy safety).** The caching architecture was already correct (HTML
  `max-age=0, must-revalidate`; hashed `/assets/*` immutable — vercel.json + `_headers`; no service
  worker exists, so no SW lifecycle risk). The remaining gap: after a deploy, an old client opening
  a lazy route hit a dead chunk hash and got the generic error card whose "back home" button can't
  help. The ErrorBoundary now detects dynamic-import failures and shows "גרסה חדשה של סנסיי זמינה"
  with a reload action — loop-safe (fresh HTML always brings current hashes) and session-safe
  (state persists in localStorage). Test-guarded.
- **Code dedup (canonicalization pass on 1.0.64–1.0.66 additions):** one canonical `EMAIL_RE` in
  `src/utils` replaces three divergent patterns (two lenient, one strict — validation is now
  uniformly strict across login/registration/reset/profile), and one shared `ErrorAlert` replaces
  four identical banner blocks in the auth screens. Data layer (DRY RUN, no execution): the only
  duplicate cluster in seed data — patients p2/p9 (יוסי/יוסף מזרחי) — is the *intentional* fixture
  that demonstrates the product's own dedup/merge feature (DedupPage + merge flow implement
  canonical selection, conflict review and traceability); merging it in seed would delete the
  feature's demo. Flagged as by-design, not executed.
- **Cross-device sweep:** all 23 routes instrumented at 375, 768 and 1366px — zero clipped or
  out-of-viewport elements outside scroll containers at any width. Touch-target census on the new
  surfaces found one real miss: the "רגע בשבילי" dismiss X (19px svg) is now a proper 28px button
  (real button semantics + comfortable target); pre-existing 22px close affordances are the
  documented inline exceptions from the earlier WCAG 2.5.8 audit. Suite: 45 files, 334 tests.

## [1.0.69] — 2026-07-06

### Changed — unified blue-only visual identity (semantic states remapped to a blue depth ladder)

- Per explicit design directive, blue and its shades are now the product's ONLY visual language:
  the semantic state families (`--error/--warning/--success/--info` + their bg/border/surface
  variants) are remapped in `styles/tokens.css` — both themes — from red/amber/green to a **blue
  severity ladder**. Light theme: severity = depth (error `#123A85` deepest → warning `#24549E` →
  success `#2F66B0`); dark theme: severity = lightness (error `#A9C7F7` lightest/most prominent).
  Because 1.0.67 forced every color through the tokens, this single-file remap restyles every
  button, chip, badge, toast, banner, chart, meter and state across all 23 routes at once — and is
  just as trivially reversible.
- **Meaning is never color-alone** (and never was): risk chips carry Hebrew labels, error banners
  carry icons + a "שגיאה" badge, toasts carry per-type icons, the strength meter carries text, KPI
  cards carry labels — the blue remap changes hue, not comprehension. All remapped text-on-tint
  pairs were computed at 5.0–13.5:1 (light) and 6.4–9.5:1 (dark) before committing, and the
  empirical WCAG contrast suite passes against the new values in both themes.
- Two indigo-leaning shadow literals (`rgba(62,67,194)` AI-FAB glow, `rgba(35,38,111)` banner
  shadow) aligned to the standard primary/navy shadow values; an rgba census confirms every
  remaining alpha literal is navy/blue/white/black. Known limit, noted honestly: the mascot logo
  is a raster illustration with violet tones — recoloring brand artwork is an asset decision, not
  a code change. Suite: 45 files, 333 tests.

## [1.0.68] — 2026-07-06

### Fixed — final polish pass (instrumented sweep, all routes, 375px→desktop)

- A product-polish sweep instrumented every route for horizontal overflow, clipped elements and
  layout distortion at mobile and mid widths, in both themes, with a focused walkthrough of the
  surfaces added in 1.0.64–1.0.67. Three real defects found and fixed, all mobile-width:
  - **"רגע בשבילי" card crushed its own copy on phones** — the fixed-width CTA squeezed the text
    column to 22px (one word per line; a 262px-tall card). The card now wraps and below 560px the
    CTA takes its own full-width row: 141px tall with a 196px text column (measured live).
  - **Upload processing row distorted its icon** — the 48px icon box lacked `flex-shrink: 0` and
    compressed to 28px next to long filenames; filenames now also truncate with an ellipsis
    (`dir="ltr"`, logical alignment) instead of squeezing their neighbors.
  - **Signup said "לפחות 8 תווים" twice** (placeholder + strength-meter caption) while the password
    field was empty — the caption now appears only once typing starts.
- Verified clean, honestly reported: zero horizontal overflow across all 23 routes at 375px; the
  documents/reports document-level scrollWidth readings at mid widths are invisible artifacts —
  `html,body{overflow-x:hidden}` clips them, page panning is impossible, and the data tables scroll
  fully inside their own containers (measured reachable). No placeholder/lorem/debug copy anywhere
  (scanned). Suite: 45 files, 333 tests.

## [1.0.67] — 2026-07-06

### Changed — global design-system color standardization (hex ratchet 66 → 8)

- Every color in the application now comes from the design system. The frozen debt of 66 hardcoded
  hex literals is paid down to exactly 8 — the `AVATAR_PALETTE` scale in `src/utils/index.ts`, the
  only sanctioned raw hex outside `styles/tokens.css` (avatarColors() derives tint backgrounds and
  dark-mode initials arithmetically, which CSS variables can't feed). The canonical ratchet guard
  now scans `.ts` as well as `.tsx` and its baseline is **8, non-increasing**.
- **Constant whites → `var(--on-accent)`** (35 sites): icon fills and text on colored/gradient
  surfaces, white tiles (logo, AI mascot), the print stylesheet, selected-day calendar text.
  Identical rendering in both themes — the token stays white by design.
- **Status hexes → semantic tokens**: `#9A6200/#8F2A24/#2E6B35` (exact token values) now reference
  `--warning/--error-dark/--success`; `#F3F7FD/#0A1426` eliminated by reading the computed `--bg`
  token for the browser-chrome `theme-color` meta (verified live: light `#F3F7FD`, dark `#0A1426`,
  both resolved from the token, not literals).
- **Avatar palette consolidated**: the same 8 system blues previously duplicated across seed data,
  the create-patient dialog, the getPatient fallback and the profile picker now come from one
  canonical `AVATAR_PALETTE` (SSOT-mapped in ARCHITECTURE.md).
- **Off-system colors removed**: the profile avatar picker offered green/amber/red/purple identity
  swatches — green/amber/red collide with the semantic status language (a red avatar reads as an
  alert) and purple is outside the palette entirely. The picker now offers six system blues with
  Hebrew names; a previously-saved off-scale choice still renders (graceful), it just is no longer
  offered. This is the release's only user-visible change.
- Honestly N/A in this client-only build: email templates, PDF exports, maps/editors/audio-player
  libraries (none exist — the UI is dependency-free), and chart libraries (charts are hand-rolled
  and already token-driven). Verified: full suite green including both-theme contrast tests and
  axe; live checks of light + dark meta theme-color, per-patient avatar hues in dark mode, and the
  new picker. Suite: 45 files, 333 tests.

## [1.0.66] — 2026-07-06

### Added — "רגע בשבילי" (Moment for Me) v1 + real report exports

- **Moment for Me v1** (`src/components/MomentForMe.tsx`) — the P0 wellbeing feature from the Mativ
  therapist-feedback guidelines: a quiet, dismissible suggestion card on the dashboard offering a
  one-minute breathing exercise between sessions. Binding design constraints implemented exactly:
  always optional (one-click dismiss, persisted), fully removable (Settings → התראות toggle;
  re-enabling clears a previous dismissal), never trapping (early-finish button, backdrop click, and
  the global Escape cascade all close it), accessible (dialog semantics, `aria-live="polite"` phase
  cues שאיפה/נשיפה so the exercise works without the animation, reduced-motion respected by the
  existing global rules), and calm by design (design-token visuals, no noise, no judgment).
- **Reports download is now real.** The reports list's הורדה action previously showed a toast
  claiming a PDF was downloaded — with no file (download theater). It now produces a real UTF-8
  text file, honestly labeled as demo output. The Blob path is consolidated into the canonical
  `src/utils/download.ts` (shared with the transcript export).
- **Mativ guidelines audit (copy, trust, positioning):** product voice verified on-brand — the
  tagline "ניהול שקט למטפלים" and error copy already follow the empowerment framing ("shows last
  data", recovery-first); the problem-framing sweep found hits only in *clinical* content about
  patients, which is correct terminology, not product messaging. Trust visibility confirmed:
  dedicated privacy settings tab, privacy FAQ in Help, the upload-time privacy panel, and the auth
  footer keep security one tap away. No copy changes were needed.
- Sharing/import/export/sync protocol reviewed against the client-only scope: sharing (sanitized
  WhatsApp/Email menu), sync status + offline awareness, notification preferences, and the audit-log
  table already exist and are test-covered; transcript + report exports are now real. Bulk
  operations, versioning UI, templates, automation, external APIs/webhooks, two-way sync, and
  compliance tooling are backend-era scope — documented, not faked. Suite: 45 files, 333 tests.

## [1.0.65] — 2026-07-06

### Improved — Recordings & Transcriptions module (verified pass + four real gaps closed)

- Module audit (UploadPage + TranscriptPage): the upload state machine
  (idle/dragging/uploading/success/error + retry), staged pipeline, format validation, privacy
  panel, transcript speaker labels/timestamps/search/highlight/copy and loading skeletons all
  verified working — most requirements were already met. Four genuine gaps closed:
  - **Upload can now be cancelled mid-processing** — a ביטול button stops the simulated pipeline
    and returns to the drop zone (previously the user was locked in until completion).
  - **Accessible progress**: the progress bar is a real `role="progressbar"`
    (`aria-valuenow/min/max`), the stage caption is `aria-live="polite"`, success is `role="status"`
    and failure `role="alert"` — screen readers now follow the whole pipeline.
  - **Transcript empty-search state**: a zero-match query shows an explicit "אין תוצאות" state
    (`role="status"`) with a one-click ניקוי החיפוש escape hatch instead of a silently blank card.
  - **Transcript download**: a הורדה button exports the transcript as a UTF-8 `.txt`
    (speaker + timestamp per line) via a local Blob — copy already existed; export now does too.
- Honestly out of scope (would be backend/feature theater in a client-only demo): live microphone
  recording, audio playback and transcript-audio sync (no audio files exist), transcript editing
  (summaries are the editable artifact by design), and external sharing. Suite: 43 files, 327 tests.

## [1.0.64] — 2026-07-06

### Added — a complete frontend-only mock authentication experience

- **New canonical auth seam: `src/services/mockAuth.ts`.** All authentication logic (users,
  credentials, sessions) lives behind one frontend-only service — the swap seam for a real backend:
  screens and store consume only its interface and never touch storage directly. Users persist in
  `localStorage` (`sensei_mock_users_v1`); passwords are **never stored in plaintext** (mock-grade
  one-way hash, documented as obfuscation, not cryptography); no network is ever touched.
- **Credential login is now real (mock).** The login form validates against the stored users instead
  of accepting anything: unknown account and wrong password each get their own announced Hebrew
  error. The shipped demo credentials (`rotem@clinic.co.il` / `demo1234`, prefilled as before) are
  seeded as a virtual account, so the existing happy path is unchanged.
- **Registration actually registers.** Full name / email / password / confirm + terms consent, a
  live 3-segment password-strength meter (`aria-live="polite"`), duplicate-email detection, and a
  loading submit state. The created account persists across refreshes and can log in later; the
  signed-in identity flows into the profile (sidebar, app bar, settings).
- **Simulated Google sign-in.** A design-system button on the login screen with loading, success,
  and cancel (click-again) states; reuses one stable mock Google identity. No real OAuth.
- **Forgot → reset → done.** The reset flow now completes: request link (never disclosing whether
  the account exists) → sent confirmation with an explicit "demo, no email actually sent" note and
  a direct continue → new-password + confirm form → success. The password change is real — the old
  one stops working.
- **Remember Me is wired.** Checked (default): the session survives browser restarts. Unchecked:
  the session is scoped to the browser session; on the next launch the app lands on the existing
  "session expired" screen instead of the dashboard. Demo mode creates **no** session record and is
  preserved byte-identical — same instant entry, same toast, same seeded data.
- Logout clears the auth session record along with the existing teardown. Deep links still cannot
  bypass the auth gate (route-only, never view).
- Suite: 43 files, 324 tests (+23: service unit tests incl. a no-plaintext-in-storage assertion, and
  UI flow tests for rejection/acceptance/registration/Google/reset/remember-me — the remember-me
  enforcement proven red without the store guard). Verified live on the served build: wrong-password
  rejection, credential login (session record written), logout (record cleared), Google sign-in,
  and a full registration with zero plaintext leakage in storage.

## [1.0.63] — 2026-07-06

### Fixed — the calendar no longer fires a guaranteed-404 request on every visit

- A nine-module verification sweep found exactly one network defect: `CalendarPage` requested
  `/api/integrations/google-calendar/events` on **every calendar load and refresh** before falling
  back to its integration fixture. In the client-only build that endpoint provably doesn't exist, so
  each visit produced a 404 (console noise + a wasted round trip) — and the raw `fetch` bypassed the
  binding convention that **all backend access goes through `src/services/`**.
- Fix: the "is there a backend?" decision now belongs to the canonical client — `isApiConfigured()`.
  Unconfigured (today): the fixture renders directly, **zero network requests**. Configured
  (`VITE_API_BASE_URL` set): the live fetch targets `API_BASE_URL + endpoint` with the fixture kept
  as the graceful failure fallback. Identical UX and state machine (loading/ready/empty/error,
  refresh, abort) in both modes.
- Verified live on the production build: calendar + refresh with **0 failed requests, 0 console
  errors**, fixture events rendering. Guarded by `tests/calendarNoFetch.test.tsx` (proven red
  without the fix). The same sweep confirmed all 11 module routes render with **zero keyboard-dead
  interactive elements** — the 1.0.62 promotion fix covers every module. Suite: 41 files, 301 tests.

## [1.0.62] — 2026-07-06

### Fixed — click-only cards are keyboard-operable again (WCAG 2.1.1), app-wide

- A focused home-page (dashboard) audit found the KPI stat cards, "latest summaries" cards, and
  risk-alert rows were **mouse-only**: focusing them was impossible and Enter did nothing. Root
  cause was a subtle collision between two individually-correct accessibility features. The runtime
  engine that promotes `cursor:pointer` elements to `role="button" tabindex="0"` skips anything
  inside another interactive element (a correct WCAG 4.1.2 "nested interactive" guard) — but its
  selector counted **any** `[tabindex]`, including the `#main-content[tabindex="-1"]` route-focus
  landmark that every screen's content sits inside. So `closest(INTERACTIVE)` always matched, and
  **no click-only card anywhere in the app was ever promoted**. The axe suite couldn't see it (bare
  clickable `<div>`s aren't recognised as controls).
- Fix: exclude `tabindex="-1"` from the interactive-ancestor selector — it's a *programmatic* focus
  target, not a keyboard-reachable control, so it must not block promotion. One-line, additive: it
  only enables intended promotion; mouse behaviour is identical, and rows that genuinely nest a
  control (the schedule row's upload button) correctly stay un-promoted.
- Verified live on the production build: stat/summary/risk cards now `role="button"`, focusable, and
  Enter activates them (a risk row → the patient file); the appointment row stays plain. Guarded by a
  behavioural test in `tests/a11y.test.tsx` (proven red without the fix). Suite: 40 files, 300 tests.

## [1.0.61] — 2026-07-06

### Added — deep-linkable URL-hash routing (deep linking · bookmarking · browser history · testability)

- The app was purely state-driven: every screen lived at the same URL, so a screen could not
  be bookmarked, shared, reopened after refresh, reached by the browser back button, or
  navigated to directly by Playwright/manual testers. Added a **hash-based** route layer
  (`src/nav/urlHash.ts`) that keeps the store's `route` (+ `patientId` for patient screens)
  in sync with `location.hash` — e.g. `#/analytics`, `#/patient/p3`. Chosen over path routing
  because this is a client-only SPA on static hosting: the fragment delivers all five benefits
  with **zero server-rewrite config and no router dependency**.
- **Boundaries held deliberately** (per the decision framework — a route must earn its URL):
  auth screens, dialogs, overlays, command palette, and per-artifact sub-tabs stay
  state-driven — transient UI gains nothing from a URL. A deep link sets the **route only,
  never the view**, so a URL can never bypass the sign-in gate.
- **Defensive by construction:** an unknown route, a malformed/oversized patient id, or any
  hand-edited fragment is rejected and normalized to a safe screen — it can neither crash the
  app nor inject state. Guarded by `tests/urlHash.test.ts` (round-trip of all 23 routes,
  patient-id handling, injection/format rejection) and a canonical single-source-of-truth entry.
- No screen, flow, style, or business logic changed — this is pure addressability over the
  existing screens. Suite: 40 files, 299 tests.

## [1.0.60] — 2026-07-05

### Added — WhatsApp & Email sharing, wired into the two flows where it already belonged

Sharing was integrated **into existing flows only** — no standalone "share" page, no new business
logic, permissions or data models, and no duplicate buttons. Two surfaces gained it, each where a
share affordance was already implied:

- **Clinical letter** (`LetterPage`): a "שיתוף" menu button joins the existing Copy/Print action row.
  The letter is a document meant to be transmitted, so sharing fits — but because it carries patient
  details, the menu opens with a **sensitive-content warning** ("שתפו רק עם נמען מורשה ובערוץ מאובטח")
  before either channel.
- **Resources** (`ResourcesPage`): the placeholder "שיתוף למטופל" button (which only toasted a stub)
  now performs a real share of the generic, non-PHI resource title + description. No new button was
  added — the dead `onAssign`/`toast` stub was removed.

New reusable, framework-free utilities in `src/utils/share.ts` — `buildWhatsAppUrl` (`https://wa.me/?text=`),
`buildMailtoUrl` (mailto; recipient intentionally **never** auto-filled — no PII), `sanitizeShareText`
(strips control characters, normalizes newlines, preserves Hebrew/English/mixed text), and `canShare`.
A single accessible `ShareMenu` component (`src/components/shared/ShareMenu.tsx`) consumes them: full ARIA
menu-button pattern — the trigger opens on click/Enter/Space/ArrowDown; the open menu roves focus with
ArrowUp/ArrowDown (wrapping) and Home/End; Escape or Tab closes; outside-click closes; focus moves to the
first option on open and returns to the trigger on Escape; disabled when there is nothing to share; WhatsApp
opened via `window.open(..., 'noopener')` (no tabnabbing). Covered by `tests/share.test.ts` (URL building,
encoding, no-PII, sanitization) and
`tests/shareMenu.test.tsx` (menu UX, a11y, safe WhatsApp open). No secrets, tokens, internal IDs, or
system metadata are ever placed in a share payload.

Docs updated in step (README architecture map, ARCHITECTURE single-source-of-truth table, TESTING suite map
+ counts, CONTENT_GUIDE share-affordance microcopy + messaging-scope note). Lint 0, typecheck 0, **37 files /
265 tests** (3 consecutive green runs), logic-layer coverage ~94% lines / ~84% branches, production build clean,
no regression.

## [1.0.59] — 2026-07-05

### Changed — prep report links onward to the timeline (jobs-to-be-done efficiency)

A jobs-to-be-done review found the product well-aligned overall — the Dashboard surfaces *prioritized,
context-aware* next actions ("prep for session with {next patient}", "review {n} pending summaries",
"high-risk: {name}" → patients pre-filtered), the patient page hubs the per-patient jobs, and upload
pre-selects the patient. The one friction point: the **prep report** (`ReportPage`, the "prepare for the
next session" job) was the only patient sub-page with no onward link — to review the patient's history the
therapist had to hop back through the patient page.

- Added a **"ציר הזמן המלא ›"** (full timeline) link to the report header — one click from prep to the
  patient's complete session history, the natural next step when preparing. Uses the same link pattern the
  patient page and sibling sub-pages already use; fixes the cross-navigation asymmetry (Summary/Transcript/
  Letter already cross-link). Verified live: the link renders and navigates to the timeline.
- Guarded by `tests/reportNav.test.tsx`. Lint 0, typecheck 0, **35 files / 244 tests**, build clean.

---

## [1.0.58] — 2026-07-05

### Fixed — the closed mobile nav drawer no longer traps keyboard focus off-screen (WCAG 2.4.3)

- An interface-wide visual/layout review (overflow, clipping, alignment, responsiveness sweep across
  routes at mobile + desktop) came back clean except for one real defect in the **off-canvas mobile
  navigation drawer**. Below 860px the sidebar slides off-screen via `transform: translateX(105%)` when
  closed — but transform alone leaves the element fully in the tab order and the accessibility tree.
  Measured at 375px with the drawer closed: **14 nav links still keyboard-focusable**, sidebar neither
  `inert` nor `aria-hidden`. So a keyboard user tabs into invisible off-screen controls (focus
  disappears), a screen reader announces the entire hidden menu, and focusing an off-screen link can
  shove the viewport sideways (a transient horizontal-scroll/layout-instability I reproduced).
- Applied the standard accessible off-canvas pattern: the closed drawer is now `visibility: hidden`
  (which removes it from both the tab order and the accessibility tree), restored to `visibility:
  visible` on `.open`. A `transition: …, visibility 0s linear .26s` delay keeps it visible through the
  slide-out animation, then hides it; opening reveals it immediately. Scoped inside the
  `@media (max-width:860px)` block, so the desktop sidebar rail stays fully visible and interactive.
- Verified live at 375px: closed → `visibility:hidden`, links unfocusable; open (via the toggle) →
  fully visible, all links focusable, drawer renders correctly. No page-overflow or clipping defects
  were found on any other route. Guarded in `tests/canonical.test.ts`.

---

## [1.0.57] — 2026-07-05

### Changed — CI automation is more predictable & monitorable

A review of the project's automations (CI, guards, scripts) found them largely sound — but the CI workflow
lacked run-concurrency control, and its monitoring story wasn't documented.

- **Predictable runs.** Added a `concurrency` group to `.github/workflows/ci.yml`: a new push supersedes
  older in-progress runs on the same PR/branch (so the newest run is always the authoritative status and CI
  minutes aren't spent on stale commits) — but `main` is **never** cancelled, so every landed commit gets a
  full gate.
- **Monitoring documented.** README now explains how to watch CI (the Actions tab / per-PR checks) and
  provides a ready-to-add status badge (to drop in once the repo is on GitHub), plus a pointer to the
  CONTRIBUTING enforcement table where every guard's threshold and **config location** is listed.

Review notes (verified, no change needed): the duplication guard genuinely **fails** over threshold
(`jscpd --threshold 1` → exit 1); thresholds are externalized in named config files (`.jscpd.json`,
`vite.config.ts`) not hard-coded in the pipeline; and the guards are documented and deterministic. No
product/runtime change; app gate green (242 tests, build clean).

---

## [1.0.56] — 2026-07-05

### Added — developer workflow scripts (efficiency / automation)

A workflow review found CI is already comprehensive (lint → typecheck → coverage → dup → build → audit),
but two local actions were repetitive/manual: running the gate as four separate commands, and packaging a
release archive with a long hand-maintained `zip -x …` exclude list — which reinvented `git archive` (the
repo already has `.gitattributes` `export-ignore` for exactly this).

- **`npm run check`** — one-shot local gate: `lint && test && build` (typecheck runs inside `build`, so no
  redundant `tsc`). Mirrors the core CI gate in a single command; run it before pushing.
- **`npm run package`** — `git archive --format=zip -o sensei-app-2026.zip HEAD`: a clean, portable source
  archive (tracked files only, respects `export-ignore`), replacing the fragile manual `zip` command.
  Packages committed HEAD, so uncommitted WIP is never shipped. `*.zip` added to `.gitignore`.
- Documented both in the README "Running" section. No product/runtime change.

### Changed — empty states now offer a recovery action (no dead-ends)

Reviewed every empty state. The genuinely-empty screens (Patients, Sessions) already have create-actions,
and Calendar has refresh + new-event; the gaps were **filtered-empty** states that stranded the user:

- **Documents** ("אין מסמכים בקטגוריה זו") — added a "הצגת כל המסמכים" button that clears the status filter.
- **Reports** ("לא נמצאו דוחות תואמים") — added a "ניקוי החיפוש והסינון" button (when filtering) that resets
  search + filter; copy adapts to whether a filter is active.
- **Messages** ("אין שיחות תואמות") — added a "ניקוי החיפוש" link that clears the conversation search/filter.
- Reuses existing tokens + the app's clear-filter pattern; guarded by `tests/emptyStateRecovery.test.tsx`.

Lint 0, typecheck 0, **34 files / 242 tests**, production build clean, no UI regression.

---

## [1.0.55] — 2026-07-05

### Fixed — Timeline now has a breadcrumb back to the patient (navigation consistency)

A UX/navigation audit found the patient **Timeline** (ציר זמן) was the only patient sub-page **without a
breadcrumb** back to the patient — Summary, Report, Letter and Transcript all have one, and Upload/Patient
too. In this router-less SPA there is no browser Back, so the timeline was a mild dead-end (you had to use
the sidebar or the patient-switcher).

- Added the standard breadcrumb to `TimelinePage` — `{patient name} › ציר זמן`, with the patient name
  linking back to the patient (`navigate('patient')`), matching the exact markup + `.tl-crumb:hover` style
  the sibling sub-pages use. No other change.
- Verified live: the crumb renders (`מיכל כהן › ציר זמן`) and clicking the name returns to the patient page.
- Guarded by a new `tests/canonical.test.ts` assertion that **every** patient sub-page (Summary/Timeline/
  Report/Letter/Transcript) has a `-crumb` breadcrumb + a `navigate('patient')` handler, so this consistency
  can't silently regress.

Lint 0, typecheck 0, **34 files / 240 tests**, production build clean, no other UI/UX change.

---

## [1.0.54] — 2026-07-05

### Changed — search-match highlighting completed across all list pages (UX consistency)

Following the patients-list highlighting (1.0.52), the two remaining list pages with a text search now
highlight the matched term via the app's canonical `hlParts` — so every search surface (global search, ⌘K
palette, search page, transcript, patients, sessions, resources) reads consistently, making it obvious why
each result matched.

- **`SessionsPage`** — highlights the matched term in the session's patient **name** and **topic chips**.
- **`ResourcesPage`** — highlights the match in the resource **title** and **description**.
- **Documents & Tasks** were reviewed and intentionally excluded — they filter by status/category only (no
  free-text search), so there is nothing to highlight.
- No new logic/styles — the existing `hlParts` + `--selection` token; filtering/sorting unchanged. Verified
  live (sessions "דנה" → 2 highlights; resources "CBT" → 1). Guarded by `tests/listSearchHighlight.test.tsx`.

### Added — behavioural test coverage for 8 previously-untested journeys

Expanded the suite (each self-verified, no `src/` changes): `clipboard` (copy-to-clipboard + Snackbar toast),
`notifications` (unread count / mark-read / filter), `commandPalette` (⌘K type → filter → navigate),
`editPatient` (edit dialog prefill + save), `emptyStates` (patients/sessions no-results + recovery),
`pagerInteraction` (page-through changes rows), `mergeFlow` (dedup merge removes the duplicate, keeps
canonical), and `listSearchHighlight` (sessions/resources highlight).

Lint 0, typecheck 0, **34 files / 239 tests** (3 consecutive green runs), production build clean, no UI/UX
regression, no backend/network in tests.

---

## [1.0.53] — 2026-07-04

### Added — tests for the accessibility-preference appliers (no UI change)

Coverage pass targeting the last clearly-untested core feature: the **user accessibility preferences**. The
a11y suite already covers axe + keyboard combobox, but the preference *appliers* — a real WCAG feature — had
no test.

- **`tests/a11yPrefs.test.tsx` (4)** — `setA11y` / `resetA11y` write to the document root: safe defaults on
  mount, each preference toggling its `data-a11y-*` attribute (contrast/motion/focus/reading/underline), the
  text-size setting mapping to `<html>` zoom (small .9 / large 1.15 / xlarge 1.3), and `resetA11y` restoring
  every default. Drives the real store via the `useApp()` context (the `pager.test` probe pattern); no DOM
  mocks.

Confirmed the global ⌘K palette shortcut is already exercised (a11y suite dispatches the keydown), so no
redundant shortcut tests were added. Documented `patientsSearch` + `a11yPrefs` in TESTING.md and refreshed
counts. Lint 0, typecheck 0, **24→25 files / 215 tests** (3 consecutive green runs), build clean, no
backend/network/UI change.

---

## [1.0.52] — 2026-07-04

### Changed — patients-list search highlights matches (search consistency)

The patients list filtered on search but did not highlight the matched term — the same gap just fixed for
the transcript. Five list pages share this (patients, sessions, documents, resources, tasks); patients is
the highest-traffic and its search matches by **topic/focus** as well as name, so a highlight makes it
obvious *why* each patient matched (e.g. searching "חרדה" shows which patients' focus contains it).

- `PatientsPage` now renders the patient **name and focus** through the app's canonical `hlParts`
  highlighter — the same one the global search, ⌘K palette, search page, and transcript use — so search
  reads consistently across the app. Filtering, sorting, and all other behaviour are unchanged; the
  highlight uses the existing `--selection` token (no new styles/logic).
- Verified live (dark mode): searching "חרדה" highlights the term in the matched patient's focus line;
  name searches highlight the name; clearing the query removes highlighting.
- Added `tests/patientsSearch.test.tsx` (2): topic match highlights the focus, name match highlights and
  clears.

Lint 0, typecheck 0, **23→24 files / 211 tests** (3 consecutive green runs), build clean, no other change.
(The four remaining list searches — sessions/documents/resources/tasks — can adopt the same helper later;
left for a focused follow-up rather than a broad sweep.)

---

## [1.0.51] — 2026-07-04

### Added — behavioural tests for the upload flow and theme application (no UI change)

Another coverage pass targeting the remaining untested critical journeys. Two new deterministic suites; no
redundant tests, no UI/UX/logic changes, no new dependencies, no live APIs.

- **`tests/upload.test.tsx` (2)** — the audio-upload state machine (previously only `validateFile` unit +
  demo-gating): an unsupported file dropped on the zone shows the "אינו נתמך" format error (MP3/WAV/M4A),
  and a supported file leaves the idle drop zone for the processing pipeline. Drives the real `S.upload`
  store via a `drop` event; asserts the immediate state transition, not the simulated progress timer.
- **`tests/theme.test.tsx` (2)** — theme application to the document (`resolveTheme` is unit-tested pure;
  this covers the DOM side effect): the persisted preference is applied to `<html data-theme>` on load, and
  the app-bar theme control toggles light → dark.
- Also documented `transcript`/`upload`/`theme` in TESTING.md and refreshed suite counts.

Verified: lint 0, typecheck 0, production build clean, **21→23 files / 209 tests**, four consecutive green
runs (deterministic), no backend touched, no network in tests, no visual/behavioural change to the app.

---

## [1.0.50] — 2026-07-04

### Changed — transcript search now highlights matches (canonical highlighter, consistency fix)

A review of the recording/transcription module (a client-side *simulated* pipeline — no live mic/API, so
capture/permission/waveform items are N/A by design) found the module already canonical (`validateFile`,
`sessions` data, and `S.upload` state are each single-sourced; no duplication). One genuine inconsistency:
the **transcript in-viewer search only filtered lines — it did not highlight the matched term**, while the
global search, ⌘K palette, and search page all highlight via the shared `hlParts` helper.

- `TranscriptPage` now renders matched lines through the **existing canonical `hlParts`** highlighter
  (no new logic), so the matched term is bolded on the `--selection` token — identical to search everywhere
  else in the app. Filtering behaviour is unchanged. Verified live (dark mode): searching "הצגה" filters to
  the 3 matching lines and highlights the term in each, at ~7:1 contrast.
- Added `tests/transcript.test.tsx` (3): two-sided transcript renders (speaker labels + timestamps), a query
  filters *and* highlights, and clearing restores all lines with no highlight.

No other change: the module's UX, states (idle/uploading/success/error, skeleton-loading, no-results), copy,
and design-system usage were verified consistent and left intact. Lint 0, typecheck 0, **20→21 files /
205 tests**, build clean.

---

## [1.0.49] — 2026-07-04

### Fixed — public-release privacy/secrets audit: removed developer traces (no product change)

A strict pre-publish privacy/PII/secrets audit of the whole repo found no exposed secrets, credentials, or
real PII, but three developer-machine traces and one release-safety gap — all fixed. Product behavior,
UI, UX, and demo data are unchanged.

- **Local machine paths + username removed.** `.claude/launch.json` carried `"cwd":
  "/Users/lital/Desktop/sensei-app-2026"` twice, and `PORTING_GUIDE.md` embedded a
  `/private/tmp/.../-Users-lital/...` scratch path — both leaked a local username. Dropped the redundant
  `cwd` (the runner defaults to the project root) and replaced the doc path with a neutral placeholder.
- **Landing URL dropped** from a `tokens.css` comment (`https://sensei-say.netlify.app/`) — a stray deploy
  reference, comment-only, no behavior impact.
- **`.gitignore` hardened** to prevent accidental secret/local-file commits: `.env` / `.env.*` are now
  ignored while `.env.example` (the safe, empty template) stays tracked; also `.vite` and `*.log`.

Verified clean: no `lital`/local-path/secret/`netlify` references remain in tracked files (excluding the
required Heebo `OFL.txt` font license and standard `package-lock` sponsor URLs). Seed demo data (therapist
`ד״ר רותם שגב`, patients) is fictional/placeholder — intentional and left intact. Lint 0, typecheck 0,
202 tests, build clean.

---

## [1.0.48] — 2026-07-04

### Added — behavioural tests for three untested critical flows + a flaky-test fix (no UI change)

A second coverage pass over the already-mature suite (17 files / 194 tests) targeted the remaining
behavioural gaps that static guards and smoke tests did not exercise. Three new deterministic suites, no
redundant tests, no UI/UX/logic changes, no new dependencies, no live APIs.

- **`tests/routing.test.tsx` (2)** — the state-driven router's safety net: an unknown/stale `route` key
  falls back to the dashboard (no crash, no blank, not the error card), while known routes still render
  their own screen. Guards the `PAGES[route] || PAGES.dashboard` fallback.
- **`tests/globalSearch.test.tsx` (3)** — the app-bar search journey end to end: a matching query opens the
  results listbox with a selectable option, a no-match query shows the "לא נמצאו תוצאות" empty state (not a
  broken panel), and clearing the query closes it. Exercises real store + ranking.
- **`tests/patientLifecycle.test.tsx` (3)** — the highest-risk destructive flow: deleting a patient requires
  confirmation, removes the record on confirm, offers a working undo that restores it, and keeps the record
  when cancelled. The patient name is read from the confirmation dialog, so assertions hold regardless of
  list sort/pagination.
- **Flaky-test fix.** Adding three more full-`App` suites raised parallel load and exposed a latent race in
  the existing `formValidation` focus assertion (fixed 80 ms delay vs. an asynchronously-applied focus). Made
  it deterministic with `waitFor` (poll until focus lands) — the root cause, not a skip. Full suite verified
  green on three consecutive runs.

Verified: lint 0, typecheck 0, production build clean, **20 files / 202 tests**, no backend touched, no
network in tests, no visual/behavioural change to the app.

---

## [1.0.47] — 2026-07-04

### Removed — Professional Development (CPD / "התפתחות מקצועית") feature, in full

Per product decision, the Professional Development feature was removed. Footprint mapped first, then
removed with no dangling references.

- **Page & style deleted:** `CpdPage.tsx` (CPD-hours ring, license-renewal card, course cards) and `cpd.css`.
- **Navigation/routing:** the `cpd` destination removed from `navConfig` and `ROUTE_TITLES`, and from the
  lazy `PAGES` map — sidebar now **13** destinations; the "ידע ומשאבים" group keeps ספריית משאבים + מסמכים
  (non-empty, no gap). Palette + global search drop it automatically (shared `navConfig`). Content routes
  24 → **23**.
- **State:** the exclusive keys `cpdCourse` / `cpdLogged` removed from the seed and from `PERSIST_KEYS`.
  No shared state touched (`profile` etc. untouched).
- **Tests & docs:** `navConfig` contract updated (13 destinations, 23 routes; no-orphan + distinct-icon
  guards still hold); route-smoke and axe suites auto-adjusted; README, ARCHITECTURE, CONTRIBUTING, and
  TESTING route counts synced to 23.

Verified: lint 0, typecheck 0, production build clean (no broken imports), **no console errors** on a fresh
server, remaining app renders and navigates unchanged. Suite: 17 files, **194 tests**.

---

## [1.0.46] — 2026-07-04

### Added — test coverage for three real gaps + a TESTING.md guide (no UI/UX change)

A coverage review of the existing suite (15 files / 180 tests, ~87% logic-layer) found three genuine,
high-value behavioural gaps and one missing doc. Filled only those — no redundant tests for already-covered
areas, no UI/UX/logic changes, no new dependencies, no live-API calls.

- **`tests/hebrewGrammar.test.ts` (11 tests)** — the gendered-Hebrew microcopy engine (`hg` / `hgTerm`),
  which decides the grammatical gender of nearly every Hebrew string in the app, had no direct unit test.
  Now covers `[[masc|fem|neutral]]` resolution by Hebrew gender code, inline substitution, multi-token
  templates, unmarked-masculine and neutral fallbacks, liberal gender inputs, the definite-article form,
  unknown-term fallback, and graceful degradation when `window.HG` is absent. Exercises the real resolver
  (loaded by `tests/setup.ts`), not a mock.
- **`tests/authFlow.test.tsx` (5 tests)** — the login screen's client-side validation and logout teardown
  were only smoke-rendered. Now covers: malformed-email rejection (announced via `role="alert"`, fields
  `aria-invalid`), too-short-password message, valid credentials entering the loading submit state
  (button `disabled` + `aria-busy`), Enter-key submission, and logout returning to the login screen while
  closing open overlays. Timers are asserted (loading state), never advanced — deterministic, non-flaky.
- **`TESTING.md`** — the required testing guide: stack, run commands, folder structure, suite map, mocking
  strategy (why no MSW — the API layer is dormant; `fetch` is stubbed in `apiClient.test`), coverage
  expectations (logic-layer-scoped, presentational via smoke/axe), TDD workflow, and honest known
  limitations (no E2E/Playwright, no visual-regression). Linked from README; complements — does not
  duplicate — CONTRIBUTING's enforcement contract.

Verified: lint 0, typecheck 0, production build clean, **17 files / 196 tests** (was 15 / 180), no backend
files touched, no network in tests.

---

## [1.0.45] — 2026-07-04

### Fixed — documentation drift + dead code (frontend documentation audit)

A frontend documentation-accuracy audit (every doc claim verified against source) found two real drifts
and one duplicated source of truth; all resolved. No BLOCKERs — no critical behavior was undocumented or
unverifiable.

- **Dead MUI theme removed.** `src/theme/sensei-theme.js` was a MUI `createTheme` object that mirrored
  `tokens.css` and claimed to "power the authenticated system" — but it was **never imported** (verified),
  the app uses no MUI (deps are `react`/`react-dom` only), and it duplicated the color source of truth.
  Deleted the file (and the now-empty `src/theme/`), and removed the "MUI theme mirror" references from
  README and ARCHITECTURE plus the stale "MUI-palette aligned" comment in `tokens.css`. The stack is now
  internally consistent: `tokens.css` is the single, sole source of truth for color.
- **Route-count drift corrected.** After the Clinic-Management removal (1.0.44) two stragglers still read
  "26" — `ARCHITECTURE.md` ("26 lazy-loaded pages") and `README.md` ("route smoke (all 26)") — now **24**,
  matching `ROUTE_TITLES` / `ALL_ROUTES`.

Verified: lint 0, typecheck 0, production build clean (dead file removal broke nothing), 180 tests. Docs
now match the implementation; Storybook remains absent (documented debt, not claimed to exist — no drift).

---

## [1.0.44] — 2026-07-04

### Removed — Clinic Management ("המרפאה") section, in full

Per product decision, the entire "המרפאה" (The Practice) section and all its Clinic-Management
functionality were removed. Scope was mapped first, then removed with no dangling references.

- **Pages & styles deleted:** `TeamPage.tsx` (צוות המרפאה), `SupervisionPage.tsx` (סופרוויז׳ן) and their
  `team.css` / `supervision.css`.
- **Navigation:** the `המרפאה` sidebar section and its two destinations removed from `navConfig` — the
  sidebar now shows **14** destinations in three groups + the pinned utility group (no empty header, no
  layout gap). Because sidebar, ⌘K palette and global search share `navConfig`, all three drop the routes
  together.
- **Routing:** `team` / `supervision` removed from the lazy `PAGES` map and from `ROUTE_TITLES` (content
  routes 26 → **24**). A stale persisted `team`/`supervision` route now resolves via the existing
  unknown-route fallback to the dashboard — verified live (no crash, no blank screen).
- **State:** the exclusive keys `teamSearch`, `teamRole`, `supTab`, `supCaseStatus` removed from the seed,
  and `supCaseStatus` dropped from `PERSIST_KEYS`. No shared state touched.
- **Tests & docs:** `navConfig` contract updated (14 destinations, 24 routes; the no-orphan and distinct-icon
  guards still hold); route-smoke and axe suites auto-adjusted; README + CONTRIBUTING route counts updated.

Verified: lint 0, typecheck 0, production build clean (no broken imports), **no console errors** on a fresh
server, and the remaining app renders and navigates unchanged. Suite: 15 files, 180 tests. *Note:* the
Reports feature still contains an unrelated report row titled "סיכום פעילות המרפאה" (a practice-activity
report, not part of the removed section) — left intact to avoid altering a separate feature; say the word to
remove it too.

---

## [1.0.43] — 2026-07-04

### Fixed — dark-mode readability & consistency (form controls + brand accent cards)

An empirical dark-mode contrast sweep (measuring computed colours against composited backdrops, both
themes) found the headline "black text on dark input" risk was already prevented by `color-scheme`, but
surfaced four genuine gaps and closed them. Avatar-initial "failures" were confirmed **false positives**
(≥6:1 once the 0.2-alpha chip is composited) and correctly left alone.

- **Form-control text tokenized.** The app never set input/textarea/select `color` itself — entered text
  was whatever the browser's `color-scheme` chose (pure white in dark, a UA colour elsewhere), not the
  design token. Pinned `input,textarea,select` to `var(--text)` so entered text, caret and selected value
  are AA and token-consistent in both themes (dark `#E9F0FB`, light `#0C1B3B`) instead of browser-decided.
- **Brand accent cards darken in dark mode.** Five cards (Help, CPD, Report, Dashboard banner, AI-assistant
  header) painted white/`--paper` text on `linear-gradient(--primary-darker,--primary)`. In dark mode
  `--primary` lightens to `#4D94F5`, dropping small white labels to **3.06:1**. Added tokenised gradient
  stops (`--accent-grad-1/2`) that equal the primary blues in light mode but **darken in dark mode**, plus
  a constant `--on-accent` text token — so light mode is pixel-identical and dark mode is comfortably AA.
- **CPD "register" button.** Hard-coded `#fff` on `--primary` (3.06:1 in dark) → `var(--paper)` like every
  other primary button (5.33:1), correct in both themes.
- **Support-email pill.** White pill with `var(--primary)` text fell to 3.06:1 in dark (the lightened
  primary on white) → `var(--primary-darker)` (4.85:1 dark, ~10:1 light).

Net effect: every measured text node across the audited screens now meets WCAG AA in dark mode, and three
hard-coded `#fff` literals were replaced by tokens (hex-ratchet 66 → 63). Guarded in `tests/canonical.test.ts`
(form-control colour pinned; accent-gradient tokens defined and darkened for dark mode). Suite: 15 files,
184 tests.

---

## [1.0.42] — 2026-07-04

### Fixed — Settings & Help stay reachable as the sidebar grows (pinned utility group)

- Measuring the reorganized 16-item sidebar (1.0.41) on a **1366×768 laptop** — one of the most common
  resolutions — found the destination list overflows the viewport: the nav scrolled, and **Settings and
  Help were clipped 288px below the fold**, reachable only if the user discovered the sidebar scrolls. Two
  everyday utility destinations were effectively hidden, and it would worsen with every new feature.
- Introduced a **pinned utility group**: sections flagged `pinned` in `navConfig` (currently "כללי" →
  Settings + Help) render in a fixed block at the bottom of the nav, outside the scrolling area, so they
  are **always visible** above the profile footer while the content categories scroll in the middle. This
  is the standard "settings pinned to the bottom" pattern and it makes the nav scale — new categories grow
  the scrollable middle without ever pushing the utility items off-screen.
- Kept everything inside the single `<nav>` landmark (scrollable main list + pinned block), so no
  destination leaves the navigation landmark — no accessibility regression. Verified live: at 1366×768 the
  middle scrolls while Settings + Help sit pinned and fully visible (87px above the sidebar bottom); the
  mobile nav drawer shows the same pinned group. Guarded in `tests/navConfig.test.ts` (exactly one pinned
  section, holding settings + help). Suite: 15 files, 182 tests.

---

## [1.0.41] — 2026-07-04

### Changed — sidebar navigation reorganized; five stranded features made reachable

- A navigation/IA review found **five fully-built top-level pages had no entry point anywhere in the app** —
  `analytics` (תובנות), `reports` (דוחות), `team` (צוות המרפאה), `supervision` (סופרוויז׳ן) and `cpd`
  (התפתחות מקצועית) were lazy-loaded, titled and route-smoke-tested, yet unreachable: absent from the sidebar,
  the ⌘K palette and global search (all three derive from `navConfig`), with no link from any page. Real
  functionality, invisible to users.
- Reorganized the sidebar from two loose groups into a clear, scannable hierarchy, and folded the stranded
  pages into the category each belongs to:
  - **Primary workspace** (no header): דף הבית · מטופלים · יומן · הקלטות ותמלולים · הודעות · משימות — the daily drivers.
  - **ניתוח ומדדים** (Analysis & Metrics): מדדי תוצאה · **תובנות** · **דוחות**.
  - **ידע ומשאבים** (Knowledge & Resources): ספריית משאבים · מסמכים · **התפתחות מקצועית**.
  - **המרפאה** (The Practice): **צוות המרפאה** · **סופרוויז׳ן**.
  - **כללי** (General): הגדרות · עזרה ותמיכה.
  This replaces the previous "טיפול קליני" group, which incoherently mixed outcome measures with the resource
  library and documents. Because sidebar + palette + search share `navConfig`, all five now surface in **all
  three** at once. Each new item has a distinct icon (guarded). The maintenance-only `dedup` tool stays
  contextual off Patients rather than cluttering the rail.
- Scales cleanly: new features slot into an existing category instead of extending a flat list. Guarded by a
  new `tests/navConfig.test.ts` assertion that **every navigable top-level route has a sidebar entry** (no
  orphaned routes can regress in), plus the updated 16-destination contract. Verified live: the structure
  renders in five groups and the formerly-unreachable Team page now opens from the sidebar. Suite: 15 files,
  181 tests.

---

## [1.0.40] — 2026-07-04

### Fixed — "מטופלים אחרונים" in the command palette is now genuinely recent

- A feature-gap review against the product standard found the ⌘K palette shows a section labelled
  **"מטופלים אחרונים" (Recent Patients)** on an empty query — but the data was **`S.patients.slice(0, 4)`**,
  i.e. the first four patients in seed order, never the ones the therapist actually just opened. The label
  made a promise the data didn't keep, and a returning user got no zero-effort way to jump back to the file
  they were last in (search requires typing a name; this is instant recall).
- Made the label true with a small, deterministic tracking layer — no new screen, nav item, or dependency:
  - **`pushRecent(list, id, cap)`** (in `utils`) — a pure most-recent-first, de-duplicated, capped list op.
    Re-viewing the patient already at the head is a no-op, so it is safe to call on every navigation.
  - **`store.navigate`** records the engaged patient into `recentPatientIds` whenever a `patientId` is
    carried (opening a file, summary, timeline, letter…). The key is added to `PERSIST_KEYS`, so recency
    survives reloads — consistent with the app's multi-device-continuity model.
  - **Command palette** derives the section from `recentPatientIds`, falling back to the first few only on a
    fresh session so the list is never empty. Verified live: after viewing p5 then p3, the section shows
    `[p3, p5]` most-recent-first — including p5, which the old first-four slice could never surface.
- Guarded by `pushRecent` unit tests (move-to-front, dedup, cap, idempotency, empty/undefined input) and a
  `tests/canonical.test.ts` assertion that the palette reads tracked history and the store records it. Suite:
  15 files, 180 tests.

---

## [1.0.39] — 2026-07-04

### Changed — the dedup engine now owns confidence + canonical selection (single source of truth)

- A deduplication/canonicalization review found the clustering engine (`buildDupClusters`) returned only
  raw members + per-signal scores, while **two derived facts the whole flow depends on — the cluster's
  confidence and which record is canonical — were re-derived in the UI**: `DedupPage` computed confidence
  from the meta scores and picked the surviving record by session count, and the merge dialog fell back to
  a *different* default (`members[0]`, i.e. seed order). Same concept, three places, one latent
  inconsistency.
- Made the engine the authority. Each cluster now carries two deterministic, first-class fields:
  - **`confidence`** — the cluster's strongest member score (0–99).
  - **`canonicalId`** — the proposed surviving record: most complete first (highest session count), ties
    broken by lowest id, so the same input always yields the same canonical pick.
  `DedupPage` and the merge dialog now **read these instead of re-deriving them**, so the confidence shown,
  the "רשומה ראשית מוצעת" (proposed primary) badge, and the merge's default survivor can never drift apart.
- **No change to clustering behaviour** — the weighted signals (phone 60 / surname 25 / first-name 15 /
  email 12) and the ≥ 60 threshold are untouched; these fields are pure functions of an existing cluster.
  For the seed's intentional `{p2, p9}` fixture the values are identical to before (confidence 99, canonical
  `p2`). Locked by three assertions in `tests/dedup.test.ts` (confidence, canonical pick, deterministic
  tie-break). Suite: 15 files, 180 tests.

---

## [1.0.38] — 2026-07-04

### Added — Help is reachable from anywhere, with minimal effort

- A UX review found the Help page (FAQ, keyboard-shortcut catalog, support contact + hours, and the
  onboarding-guide/tutorial restore) was **rich but hard to reach**: `help` was a real route yet was
  **absent from `navConfig`**, so it never appeared in the sidebar, the ⌘K palette (from navConfig), or
  global search. The only paths to it were ⌘K (a keyboard shortcut a non-technical therapist won't
  know) and two contextual links (Upload, Settings). On mobile — where ⌘K isn't available — there was
  effectively no discoverable route to help.
- Made Help a **first-class destination**, reachable from every screen with one interaction:
  - **`navConfig`** now lists `help` under the "כללי" (General) section. Because the sidebar, the ⌘K
    command palette, and global search all derive from `navConfig`, Help now appears in **all three
    from a single source** — persistent in the sidebar rail on desktop and in the nav drawer on mobile.
  - **App bar** gains an always-visible **"?" help button** (the top-bar convention) — zero-click
    visible, one-click to Help, on every route. It's hidden on the tight phone app bar (≤560px), where
    Help lives in the nav drawer instead, so no mobile control is crowded off-screen.
  - **Removed the now-redundant** one-off static "עזרה ותמיכה" command from the palette — it flows from
    `navConfig` now, so the palette shows it exactly once (verified). Net result is *less* special-case
    code, not more.
- No new page, content, or dependency — this is pure discoverability for an existing capability.
  Guarded in `tests/canonical.test.ts` (Help must stay a navConfig destination + carry an app-bar
  affordance, and must not be double-listed in the palette) and `tests/navConfig.test.ts` (the SSOT
  destination contract now expects 11 destinations). Suite: 15 files, 174 tests.

---

## [1.0.37] — 2026-07-04

### Added — print stylesheet so the clinical letter prints as a document, not the app

- A product/UX review of existing-but-unfinished capabilities found `LetterPage` ships a working
  **"הדפסה"** button (`window.print()`), but the app defined **no `@media print` rule anywhere** — so
  printing a formal clinical referral letter (for a patient file / insurer / referring clinician) also
  printed the entire app chrome: sidebar, app bar, search, the floating AI button, and the page's own
  action buttons. The output was unusable as a professional document. Added a single `@media print`
  block in `global.css` that hides all app chrome and anything tagged `.no-print`, whitens the page,
  and neutralizes shadows/padding on `#main-content`, so only the letter reaches paper/PDF. Tagged the
  `LetterPage` breadcrumb row and action buttons `.no-print`. **On-screen appearance is unchanged**;
  no new dependency, no logic change. Guarded by an assertion in `tests/canonical.test.ts`.
- Verified the print result on-screen by emulating the rules live (app bar + sidebar collapse to
  hidden, the letter document remains) and confirmed the `@media print` block ships in the built CSS
  bundle. Final paper output is best confirmed once with the browser's Print preview (Ctrl/⌘-P).

---

## [1.0.36] — 2026-07-04

### Added — error observability (the ErrorBoundary no longer swallows errors silently)

- A production-readiness review found the page-level `ErrorBoundary` caught render errors (showing a
  recoverable card) but **logged nothing** — a caught crash left zero operator trace, violating "if it
  runs in production it must be observable." Added `componentDidCatch` that logs the error, the failing
  route, and the component stack via `console.error`. This surfaces caught errors in the console / any
  log capture and is the **single documented hook** to wire a real error reporter (e.g. Sentry) later,
  without touching the recovery UI. Guarded by an assertion in `tests/errorBoundary.test.tsx`.
- The rest of the reliability review was re-verified robust and needed no change: `localStorage` load
  **and** save are both `try/catch`-guarded (corrupted state / quota errors degrade gracefully), and an
  unknown/stale persisted route falls back to the dashboard (`PAGES[route] || PAGES.dashboard`) under
  the ErrorBoundary + Suspense. Suite: 15 files, 172 tests.

---

## [1.0.35] — 2026-07-04

### Fixed — placeholder text contrast (WCAG 1.4.3), app-wide

- A UX/contrast audit found the app defined **no `::placeholder` style**, so all 32 placeholder
  inputs fell back to the browser-default gray (`#757575` ≈ **4.05:1** in light mode) — just below
  AA. Added one global rule pinning placeholders to `var(--text-muted)` (`opacity:1` to stop Firefox
  dimming). Verified live: **light 4.63:1, dark 4.58:1** — AA in both themes. Guarded in
  `tests/canonical.test.ts`.
- The rest of the audit (navigation, IA, forms, empty/loading/error states, keyboard operability,
  copy, responsiveness, trust messaging) was re-verified and clean; several sweep flags (sidebar nav,
  agenda text) were confirmed to be measurement artifacts on precise re-inspection (5.5–17:1). Suite:
  15 files, 172 tests.

---

## [1.0.34] — 2026-07-04

### Fixed — two dark-mode contrast failures (WCAG 1.4.3), found by empirical measurement

Measuring *actual rendered* contrast (the token-based test can't see composited/on-accent colors)
surfaced two real dark-mode failures, both fixed with light mode left identical:

- **Skip link** was `#fff` on `var(--primary)` = **3.06:1**. In dark mode `--primary` lightens
  (`#4D94F5`), so white text fails AA. Switched to `var(--paper)` (the on-accent contract) →
  **5.33:1** dark / ~5.5:1 light. Guarded in `tests/canonical.test.ts`.
- **Patient-avatar initials** used a same-hue tint bg + saturated text, which collapsed to
  **1.46–2.63:1** in dark mode (the darkest hue nearly invisible). `avatarColors` is now theme-aware:
  in dark mode it deepens the tint and lifts the initials toward white (keeping each patient's hue) →
  **6.07–6.88:1**, verified live. Light mode unchanged. A new `utils.test.ts` case proves AA with the
  WCAG math.

Other element types measured (text, buttons, chips, nav, inputs, disabled) passed; the earlier flags
(sidebar, avatar "1.0" ratios) were measurement artifacts, confirmed clean on precise re-inspection.
Suite: 15 files, 171 tests.

---

## [1.0.33] — 2026-07-04

### Changed — enabled safe stricter TS checks + removed dead code they surfaced

Full `strict` (null/any) stays deferred (it needs the larger migration), but the **independent**
compiler safety checks that pass clean are now on — hardening the codebase against whole bug classes
at zero runtime cost:

- `noUnusedLocals` / `noUnusedParameters`, `noImplicitReturns`, `noImplicitOverride`,
  `forceConsistentCasingInFileNames`.
- Fixing what they surfaced (15 issues, all compile-time, no behavior change): **removed 10 unused
  `React` imports** (dead code the ESLint config missed — unnecessary under the `react-jsx`
  transform); added `override` to the 3 `ErrorBoundary` members that override `React.Component`; made
  two early `return` paths in `useFocusTrap` explicit (`return undefined`).

The compiler now catches unused code, missing returns, accidental non-overrides, and cross-platform
casing mismatches on every build. Verified: typecheck 0 · lint 0 · 169 tests · build clean.

---

## [1.0.32] — 2026-07-04

### Added — explicit cache-control (cache-safety): immutable assets, revalidated HTML

- A cache-safety audit found the deploy configs set security headers but **no `Cache-Control`**,
  leaving cache behavior to implicit host defaults — the classic stale-UI trap (a returning user gets
  cached HTML pointing at old/purged asset hashes → dead chunks). Made it explicit in both
  `vercel.json` and `public/_headers`:
  - `/assets/*` (Vite content-hashed) → `public, max-age=31536000, immutable`
  - HTML (`index.html` + SPA routes) → `public, max-age=0, must-revalidate`
  So HTML always revalidates and pulls the current asset hashes, while hashed assets cache forever.
  Config-only; no code, UI, or behavior change. Guarded in `tests/canonical.test.ts`.
- **Intentionally not added** (would be feature additions the caching split already makes unnecessary):
  a Service Worker (none exists — nothing to keep in sync), a runtime "new version available" toast
  (with `max-age=0` HTML the next navigation/reload already serves the latest), and chunk-load-error
  auto-reload (risks reload loops; near-impossible here since the host retains immutable assets).

Suite: 15 files, 169 tests.

---

## [1.0.31] — 2026-07-04

### Optimized — removed 1.1 MB of dead image assets (production build 2.6 MB → 1.5 MB)

- A production-optimization pass measured `public/assets/` and found two brand PNGs referenced
  **nowhere** in source: `sensei-enso.png` (928 KB) and `sensei-write.png` (158 KB). Everything under
  `public/` ships as-is, so these were dead weight in every deployment. Removed both after confirming
  zero references (static and dynamic). **Production build dropped 2.6 MB → 1.5 MB (−1.1 MB, ~42%)**,
  with no functional or visual change. Verified live: no broken images, the FAB logo loads.
- Added an **asset guard** (`tests/canonical.test.ts`): every image in `public/assets/` must be
  referenced in source, so dead media can't accumulate again.
- **Intentionally left:** the three in-use images (`sensei-mark` logo, `sensei-fan` / `sensei-scroll`
  empty-state art) are somewhat larger than their display size; re-encoding them is a follow-up that
  needs image tooling and visual-fidelity checks, out of scope for a minimal, no-visual-change pass.
  The JS bundle (~78 KB gzip main, 29 lazy route chunks) and font (115 KB variable, `font-display:swap`)
  were already optimized. Suite: 15 files, 168 tests.

---

## [1.0.30] — 2026-07-04

### Changed — removed em dashes from all Hebrew copy (house-style / anti-AI-tell)

- Per an explicit copy directive, replaced **47 em dashes ("—")** across ~25 files with
  context-correct punctuation: **·** for inline label chains (`PTSD · קיפאון בטיפול`), **:** for a
  label then its detail (`סיכום הדרכה: טכניקות`), and a **period or comma** to split an action from
  its follow-up (`הבקשה נשלחה. נחזור אליכם`). Covers page subheadings, toasts, empty states,
  supervision/report titles, help text, and seed copy. Meaning preserved; no layout change.
- The standalone `—` empty-value placeholder (`phone: '—'`) is kept — it is a data indicator, not
  prose. Hebrew prefix hyphens (`ב־`, `ל־`) and technical values stay (grammatically required).
- Added a CI guard (`tests/canonical.test.ts`) that flags any em dash adjacent to Hebrew text, and
  documented the rule in [CONTENT_GUIDE.md](CONTENT_GUIDE.md). Verified live (Tasks subheading now
  uses a comma; no Hebrew-adjacent em dash renders). Suite: 15 files, 167 tests.

---

## [1.0.29] — 2026-07-04

### Added — tests that prove the deduplication engine's properties

The dedup dry-run has been requested repeatedly with an unchanged dataset — its result (one cluster,
`p2`/`p9`, confidence 99, deterministic + idempotent) is stable by design. Rather than keep
re-asserting that in prose, those properties are now **proven automatically**:

- **`tests/dedup.test.ts`** (7 tests) exercises `buildDupClusters` directly: weighted scoring capped at
  99 with the four expected signals; **determinism + idempotency** (same input → byte-identical output
  every run); phone-format normalization; the 60-point threshold (name+email similarity alone, 52,
  does not cluster); **no false positives** for distinct patients; the real seed yields exactly the one
  intentional cluster `{p2, p9}`; and the canonical (de-duplicated) set yields **zero** clusters —
  encoding the "no duplicates remain after merge" success criterion.

No source or data change — the engine and the intentional demo duplicate are unchanged; this locks
the behavior the dry-run keeps confirming. Suite: 15 files, 166 tests.

---

## [1.0.28] — 2026-07-04

### Fixed — demo state-preview links showed on the production login page

- The auth screen rendered a *"מצבי מסך (הדגמה)"* ("Screen states — demo") block with links to jump to
  the expired-session and unauthorized screens — a dev/design-review tool that shipped to real users on
  the login page (same class as the 1.0.26 upload demo-link fix). Since `demoMode` is always false
  pre-auth, the correct gate here is build-time: the block is now wrapped in `import.meta.env.DEV`, so
  Vite **tree-shakes it out of the production build** (verified: the label is absent from `dist/`) while
  it stays visible under `npm run dev` for design review.
- Extended the frontend security guard's env allowlist to permit Vite's non-secret build-time built-ins
  (`DEV`/`PROD`/`MODE`/`SSR`/`BASE_URL`) alongside `VITE_API_BASE_URL` — these are compile-time flags,
  never secrets. Added a guard (`tests/canonical.test.ts`) asserting the demo block stays DEV-gated;
  proven to fail if the gate is removed.

---

## [1.0.27] — 2026-07-04

### Fixed — upload "choose patient" select silently discarded the user's choice

- The upload page's *"בחירת מטופל להעלאה"* (choose patient for this recording) dropdown listed every
  patient but had **no `value`/`onChange`** — the selection was ignored, and "צפייה בסיכום" always
  navigated to the globally-current patient. So picking patient A and viewing the summary showed
  patient B's — a silent, misleading no-op. (A console-warning sweep across 10 routes + overlays came
  back clean; this was the one real defect.)
- Wired the existing control: options now carry the patient **id** (robust against duplicate names),
  the select is controlled and defaults to the current patient, and `goSummaryFromUpload` navigates to
  the **selected** patient. No new feature — an existing control now honors its input. Verified live
  (select round-trips; summary follows the choice) + a regression test in `tests/demoGating.test.tsx`.

The other selects across the app (filters, appointment, timeline, tasks, settings) were confirmed
already wired.

---

## [1.0.26] — 2026-07-04

### Fixed — a demo-only control leaked into the real production UI

- The upload page rendered a *"הדגמת שגיאת פורמט"* ("demo a format error") link **unconditionally** —
  a design-reference device that triggers a fake format error. A real therapist would find it
  confusing, and it violates the "no demo controls in production" standard. It's now gated behind
  `demoMode` (the same flag that drives the demo banner): visible in the design-reference demo, hidden
  in a real session. Verified live (hidden when not in demo mode) and guarded by a new test
  (`tests/demoGating.test.tsx`, both directions). No other ungated demo affordances remain — the auth
  "enter demo" button is the intended, legitimate demo entry point.

---

## [1.0.25] — 2026-07-04

### Added — tests for form validation & error-state accessibility

A feedback-states audit (validation, errors, loading, empty, success, destructive-action, RTL copy)
came back **already complete and well-built** — the notable finding was a *test* gap, not a UX gap:

- **`tests/formValidation.test.tsx`** (3 tests) covers the add-patient form's previously-untested
  validation path — empty submit shows an **announced** error (`role="alert"`) that is programmatically
  wired to the field (`aria-invalid` + `aria-describedby` → the real element) with **focus moved to the
  errored field** (WCAG 3.3.1 / 2.4.3); an out-of-range age is rejected with its specific message and
  the dialog stays open; a valid submission adds the patient and closes the dialog.

No source change — the validation, aria wiring, focus management, and gendered success toast were
already implemented correctly; this locks them against regression. Suite: 13 files, 155 tests.

---

## [1.0.24] — 2026-07-04

### Added — tests for the pager algorithm (biggest coverage gap) + documented TDD workflow

A coverage audit found the logic layer well-tested (~100% of utils/data/hooks/nav/services) **except
the store**: `AppStore.tsx` was at 45% function / 60% branch coverage, and its lowest-covered piece
was `pager()` — the pagination view-model behind the patients / sessions / documents tables, a real
algorithm (slicing, current-page clamping, range labels, prev/next disabled state, and a page-number
sequence with ellipses) with **no tests**.

- **Added `tests/pager.test.tsx`** (6 tests) covering `pager()` edge cases — page slicing + range
  label, out-of-range page clamping, the hide-when-≤6 rule, first-page disabled state, no-ellipsis at
  ≤7 pages, and two-sided ellipsis collapse at many pages — plus the pure `resolveTheme`. Lifted
  overall branch coverage **72% → 78%** and store branch coverage **60% → 72%**.
- **Documented the TDD workflow** in [CONTRIBUTING.md](CONTRIBUTING.md): Red → Green → Refactor for
  new work, the test-layer layout, determinism/isolation conventions, mocking policy, and the
  coverage-quality-over-percentage stance.

Tests + docs only; no behavior change. Suite: 12 files, 152 tests.

---

## [1.0.23] — 2026-07-04

### Fixed — AI assistant panel didn't focus its input on open (keyboard/UX)

- An overlay focus-management audit found the shell's overlays consistent **except** the "שאל את סנסיי"
  AI panel: it opened without moving focus to its message input, so a keyboard user had to Tab into the
  panel before typing (the command palette already auto-focuses its input). The panel is **non-modal**
  (no backdrop / `aria-modal`), so a focus trap would be wrong — the fix is just to focus the input on
  open and let focus flow normally otherwise. Escape already closes it via the store's global Escape
  cascade. Verified live (input focused on open; Escape closes) + a new regression test in
  `tests/a11y.test.tsx`.
- Confirmed the other overlays are already correct: modal dialogs and the ⌘K palette trap focus
  (`useFocusTrap`) and restore it; all overlays close via the global Escape cascade.

---

## [1.0.22] — 2026-07-04

### Fixed — documentation drift (stale test count) + accuracy audit

A documentation-completeness audit found the doc set accurate and well-scoped except one stale figure:

- **README cited "138 tests" in two places; the suite is 145.** Rather than hardcode a number that
  drifts on every added test, the README now describes the suite by its stable **categories** (unit ·
  route smoke · a11y · canonical guards) and lists the current guard set (copy-integrity, heading-order,
  emoji, version-consistency). The historical "138 / 35 tests" figures inside older CHANGELOG entries are
  left intact — they're an accurate record of their versions.
- Verified the rest is synchronized: ARCHITECTURE, CONTRIBUTING, CONTENT_GUIDE, and the README doc-index
  match the current implementation; PORTING_GUIDE is marked historical; each topic has one canonical
  owner. Docs-only change; no behavior change.

---

## [1.0.21] — 2026-07-04

### Added — Content & Voice guide + emoji governance; removed 2 emojis from UI content

A content-design audit against the real app came back consistent (single canonical term "מטופל" across
116 uses, no placeholder/lorem/dev text, truthful action copy) with one concrete violation:

- **Removed two 🙏 emojis** from product-authored message strings (`data/seed.ts` demo thread,
  `MessagesPage` canned reply) — both violated the product's "no emoji in UI" convention (emojis render
  inconsistently across platforms, degrade screen-reader output, don't localize). Verified live on fresh
  state: messages render emoji-free.
- **Added an emoji guard** (`tests/canonical.test.ts`): no `.ts`/`.tsx` source may contain an emoji
  (U+1F000–1FAFF). Functional glyphs (↑↓ ↺ →) are intentionally allowed.
- **Added [CONTENT_GUIDE.md](CONTENT_GUIDE.md)** — one consolidated source of truth for voice, the
  terminology dictionary, microcopy/empty/error/success patterns, Hebrew-RTL rules, the truthfulness
  rule, and content governance. Proportional to a single-product app (not 20 separate documents), and it
  explicitly marks what's N/A here (no emails/SMS/push, no presentations, Hebrew-only so no i18n layer, no
  Storybook/Figma). Referenced from README + CONTRIBUTING.

No behavior change; copy/content + docs only.

---

## [1.0.20] — 2026-07-04

### Fixed — heading-order skips on empty states (WCAG 1.3.1 / heading hierarchy)

- A frontend-completeness audit found six views jumping straight from `<h1>` to `<h3>` with no
  `<h2>` — five empty-state headings (Patients "אין מטופלים עדיין" / "לא נמצאו…", Dedup, Documents,
  Tasks) and the notifications-popover title. Screen-reader users navigating by heading level hit a
  gap. Changed those to `<h2>`; since each carries an explicit inline font-size, **appearance is
  unchanged** — the fix is purely semantic.
- Added a heading-order guard (`tests/canonical.test.ts`, documented in CONTRIBUTING) — any `.tsx`
  using `<h3>` must also use `<h2>`, and no `<h4>`–`<h6>`. axe couldn't catch these because empty
  states don't render in the route tests.

The rest of the audit came back clean and is documented in the review summary: 26 routes with no
broken/placeholder screens, empty/loading/error states present, dup <5%, bundle ~78 kB gzip main,
all 26 pages self-constrain content width (no large-desktop stretch), no runtime console errors,
axe clean, keyboard-operable search + palette. No other changes were warranted.

---

## [1.0.19] — 2026-07-04

### Fixed — command palette (⌘K) now announces the active option to screen readers (WCAG 4.1.2)

- Following the 1.0.18 global-search combobox work, the ⌘K palette was already keyboard-navigable
  (ArrowUp/Down, Enter, `role="listbox"`/`option`, `aria-selected`) — but its input lacked
  `role="combobox"` + `aria-activedescendant`, so a screen-reader user pressing arrows saw the
  highlight move **silently**: the active option was never announced.
- Added `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete`, and
  `aria-activedescendant` (wired to the active option's `id`) — mirroring the global-search
  combobox so both share one canonical pattern. Verified live (ArrowDown → `aria-activedescendant`
  advances `cmdopt-0 → cmdopt-1 → cmdopt-2`, active row `aria-selected="true"`) and covered by a new
  regression test in `tests/a11y.test.tsx`. Purely additive ARIA; no behavior change.

---

## [1.0.18] — 2026-07-04

### Fixed — global search dropdown is now keyboard-operable (WCAG 2.1.1)

- The app-bar global search showed a rich results dropdown (matching patients + quick-nav routes),
  but it was **mouse-only**: `Enter` jumped to the full search page and the result rows were plain
  `<div onClick>` — unreachable by keyboard, violating the "full keyboard operability" standard.
- It is now a proper **combobox**: `ArrowDown`/`ArrowUp` move a highlighted option,
  `aria-activedescendant` tracks it (rows are `role="option"` in a `role="listbox"`), `Enter` opens
  the highlighted result (or falls back to full search when none is highlighted), and `Escape`
  closes. Mouse hover and keyboard share one active state, so behavior is consistent. The active row
  is highlighted with `var(--primary-surface)`.
- Verified live (ArrowDown highlights → `aria-activedescendant`; Enter navigates to the patient;
  Escape closes) and covered by a new regression test in `tests/a11y.test.tsx`. axe remains clean.

---

## [1.0.17] — 2026-07-04

### Changed — application name unified as "Sensei" (`סנסיי`) + richer metadata

The app name was already consistent in user-facing UI (19 × `סנסיי` — the Hebrew rendering of
Sensei — across the sidebar, auth wordmark, AI assistant, org name, and greeting) and in docs
(`Sensei`), with the per-route `document.title` prefixed `סנסיי ·`. This change tidies the two
remaining spots:

- **Package identifier** `sensei-app-2026` → `sensei`, so the technical name matches the app name.
  (The project folder and preview-server config keep their path for tooling continuity.)
- **HTML metadata** gained `application-name`, `apple-mobile-web-app-title`, `description`,
  `og:title`, and `og:description` — all carrying `סנסיי`, matching the `<title>` and UI brand.
  Verified live: `document.title = "סנסיי · מטופלים"`, `application-name = "סנסיי"`.

The user-facing wordmark is kept in Hebrew (`סנסיי`) to match the all-Hebrew RTL UI; switching it
to a Latin "Sensei" wordmark is a one-line branding change if preferred. No behavior change.

---

## [1.0.16] — 2026-07-04

### Added — regression guard for the 1.0.15 copy fixes + fixed stale doc baseline

- **Extended the copy-integrity guard** (`tests/canonical.test.ts`) to protect the 1.0.15 fixes, not
  just merge: the delete-patient / delete-session dialogs + toasts and the summary-approval status
  must promise no activity-log logging and no N-day retention (immediate undo only). Proven to fail
  CI on a re-added "30 יום" claim. Scoped to those action files, with a documented, principled
  exception: general capability/policy descriptions that represent the demo's audit feature
  (`HelpPage` privacy FAQ, `DocumentsPage` signature note — alongside the equally-represented
  RBAC/PII claims) are intentionally out of scope; only per-action confirmations must be literally
  true in this build.
- **Fixed stale documentation drift:** CONTRIBUTING cited the hardcoded-hex ratchet baseline as
  **82** in two places; the actual guard has used **66** since 1.0.9. Corrected. (The `82` in the
  historical CHANGELOG entry is left as an accurate record of that version.)

Both documented in [CONTRIBUTING.md](CONTRIBUTING.md) § "Enforcement rules". No dependencies; no
behavior change.

---

## [1.0.15] — 2026-07-04

### Fixed — delete/session/summary copy over-promised recovery & audit logging

Follow-through on the 1.0.13 truthfulness pass — the three same-class claims flagged there are now
corrected (verified against actual behavior first):

- **Patient delete** kept the record removable only via the immediate undo toast, but the dialog +
  toast promised *"kept in archive 30 days before final deletion."* Now: *"you can undo the action
  immediately after it's performed."*
- **Session delete** soft-removes to the persisted `deletedSessions` store with immediate undo, but
  claimed *"recoverable within 30 days"* (no expiry logic, no restore surface after the toast). Now
  the same immediate-undo wording.
- **SummaryPage** stated an approval was *"logged to the activity log"*; the Privacy "Audit Log" is a
  static fixture nothing writes to, so that clause is removed.

The true parts are preserved (immediate undo; the verified-on date). Copy-only, no behavior change.
Verified live: delete-patient dialog renders the corrected wording with no "30 days" claim. A sweep
confirms no fabricated retention/audit claims remain anywhere (the notification archive, which is
backed by a real persisted store, is unchanged).

---

## [1.0.14] — 2026-07-04

### Added — Phase 9.5 enforcement: two low-noise guards closing real drift gaps

Most Phase 9.5 enforcement already exists (jscpd duplication guard; single-source-of-truth,
architecture, RTL, hardcoded-hex, docs-exist guards in `tests/canonical.test.ts`; security, axe,
contrast, focus-trap suites; the CI release gate). Several spec areas are structurally N/A here
(no Storybook, no Design-System package, no i18n key system, no backend/API contracts, no
database/migrations). Two genuine gaps are now closed — both deterministic, scoped, and proven to
fail on regression:

- **Version-consistency guard** (`tests/canonical.test.ts`) — the docs guard proved required files
  *exist*; this proves they're not *stale*: `package.json` version must equal the newest CHANGELOG
  heading and the README version badge. A bump in one file that misses the others now fails CI.
- **Copy-integrity guard** (`tests/canonical.test.ts`) — regression protection for the 1.0.13 fix:
  the patient-merge copy must not re-introduce an "archived / restorable / logged to the activity
  log" promise that `confirmMerge` doesn't perform. Scoped to merge-flow lines only, so the
  legitimate notification archive and the separate delete flows are unaffected.

Both documented in [CONTRIBUTING.md](CONTRIBUTING.md) § "Enforcement rules" with owner, verify
command, failure condition, and rollback. No new dependencies; no behavior change.

---

## [1.0.13] — 2026-07-04

### Fixed — patient-merge copy claimed archival + audit logging the code never performs

- A dry-run deduplication scan of the seed dataset found exactly **one** genuine duplicate cluster
  (`p2` יוסי מזרחי / `p9` יוסף מזרחי — identical normalised phone `0527654321`, confidence 99),
  which is intentional demo content for the app's own duplicate-detection feature. No action taken
  on the data (default DRY RUN; the cluster is left in place to exercise the feature).
- **The merge feature's copy over-promised.** The merge dialog and toast (`Dialogs.tsx`) told the
  user the duplicate would be *"moved to archive and can be restored"* and *"logged to the activity
  log,"* but `confirmMerge` filters the record out of state permanently — there is no
  `archivedPatients` store and the Privacy "Audit Log" is a static fixture nothing writes to. The
  copy is now truthful: *"the duplicate record will be removed from the list; sessions merge into
  the primary."* Same unbacked *"logged to the activity log"* line removed from the delete-all-data
  dialog. Behaviour unchanged (copy-only). Verified live: merge dialog renders with no
  archive/audit claim.
- **Reported, not changed (await decision):** the patient-delete and session-delete flows carry the
  same *"recoverable within 30 days"* wording backed only by a transient undo toast, and
  `SummaryPage` states an approval was *"logged to the activity log."* Same class of gap in separate
  features — left for an explicit call rather than reworded unilaterally.

---

## [1.0.12] — 2026-07-04

### Fixed — notifications popover clipped off-screen on phones (same class as 1.0.11)

- The notifications popover (opened from the app-bar bell that 1.0.10 made reachable on mobile)
  anchors to the small, off-centre bell with a 360px width. On phones it overran the viewport —
  at 375px its leading edge sat at **+30px past the right edge**, clipping the start of each
  notification row. Fixed with the same viewport-pinned treatment as the search dropdown: at
  ≤560px both app-bar popovers now share one rule (`.appbar-search-panel, .appbar-popover-panel`)
  that pins them to symmetric 16px insets. Verified live at 375px (panel 16→359px, no overflow)
  and 1024px (unchanged, 360px anchored to the bell). This clears the last fixed-width dropdown in
  the app shell — a codebase scan confirms only these two anchored popovers exist in the shell.

---

## [1.0.11] — 2026-07-04

### Fixed — global-search results dropdown clipped off-screen on phones

- The app-bar search-results dropdown has `min-width:360px` and anchors to the search box's
  trailing edge. With the search box narrow on phones (post-1.0.10), the 360px panel overran the
  viewport — at 375px its trailing edge sat at **-51px**, clipping the risk badge on every result
  row. At ≤560px the panel is now pinned to the viewport with symmetric 16px insets
  (`position:fixed; left/right:16px; width:auto`), so it fills the width cleanly with nothing cut
  off. Desktop keeps the anchored 360px dropdown (rule only fires ≤560px). Verified live at 375px
  (panel 16→359px, no overflow) and 1024px (unchanged, 360px anchored).

---

## [1.0.10] — 2026-07-04

### Fixed — mobile app-bar: unreachable controls + sub-24px touch targets (WCAG 2.2 §2.5.8)

- **Notifications and account controls were clipped off-screen on phones.** The app-bar
  search had `min-width:190px` plus a `flex:1` whitespace spacer, and on narrow widths
  (≤~400px) these squeezed the notifications bell and account/avatar button past the trailing
  edge — rendered at negative coordinates, clipped by the page's overflow guard, and
  **unreachable** (the account menu is also in the drawer, but the notifications panel is not).
  At ≤560px the spacer is now collapsed and the search min-width dropped, so every control stays
  on-screen at 320–560px while the search stays usable (~100px at 375–390px). Desktop layout is
  unchanged (the rule only fires ≤560px). Verified live at 320/375/390 px.
- **Two touch targets were below the 24×24px minimum.** The sidebar logout icon measured
  20×20px (now a 24×24px hit area via transparent padding; the glyph stays 20px), and the
  app-bar theme toggle shrank to 21px wide at mobile because it lacked `flex-shrink:0` (now
  holds its 38×38px). Both verified live at mobile width; no other sub-24px controls remain.

---

## [1.0.9] — 2026-07-04

### Fixed — dark-mode on-accent contrast (WCAG 1.4.3) + reduced hardcoded-hex debt

- On-accent text (filter chips, toggles, pager, message bubbles, gender selector) used a
  hardcoded `#fff`, which in dark mode is white on the lighter accent (`#4D94F5`) = **3.06:1**,
  below the 4.5:1 AA threshold for normal text. This was invisible to the token-based contrast
  test (it audits tokens, not hardcoded hex). Converted these 16 cases to `var(--paper)` (the
  on-accent color contract): **light mode is unchanged** (`--paper` = `#FFFFFF` = `#fff`), and
  **dark mode now measures 5.33:1** — verified live. Hardcoded-hex ratchet lowered 82 → 66.
- Data-driven avatar backgrounds and on-accent icon fills (pass the 3:1 graphics threshold) keep
  `#fff` intentionally.

---

## [1.0.8] — 2026-07-04

### Added — client-ready API layer (dormant; no backend exists yet)

There is no backend to connect to (verified: none on disk or on the linked GitHub account),
so instead of fabricating an integration, added a canonical, typed API layer that stays inert
until a backend is configured — all current flows (seed data + localStorage) are unchanged.

- `src/services/apiClient.ts` — single typed fetch client: base URL from `VITE_API_BASE_URL`,
  Bearer auth via a pluggable token provider (no token hardcoded/stored), timeout + AbortController,
  consistent typed `ApiError`, `isApiConfigured()` gate.
- `src/services/crud.ts` + `index.ts` — generic `ApiService<T>` (list/get/create/update/remove) +
  patients/tasks/documents/notifications/auth service instances.
- `src/types/index.ts` — domain model types (the API contract; mirrors the seed shape).
- **Dormant:** no runtime code imports the layer, so it is tree-shaken from the build.
- Tests: `tests/apiClient.test.ts` (6) — dormant-when-unconfigured, URL/query building, header +
  Bearer injection, error mapping, 204. Architecture guard now covers `services`/`types` as leaf
  modules. Security guard allows exactly `VITE_API_BASE_URL` (client-safe), flags any other env read.
- `.env.example` documents `VITE_API_BASE_URL`; ARCHITECTURE.md gains a "Wiring a backend" section.

Suite: 138 tests green.

---

## [1.0.7] — 2026-07-04

### Added — Phase 9.5: automated deduplication & consistency enforcement

- **Canonical/architecture/drift guards** (`tests/canonical.test.ts`, 35 tests): every canonical
  symbol must be defined exactly once in its stated home; leaf modules (`utils/data/hooks/nav`)
  may not import UI/state; no page→page imports; required docs must exist; hardcoded-hex ratchet
  (≤82 baseline, non-increasing).
- **Code-duplication guard**: `jscpd` (`npm run dup`, `.jscpd.json`) fails CI above 5% (current 3.19%,
  min-tokens 80). Verified it rejects when exceeded.
- **Docs**: added `ARCHITECTURE.md` (layer rules + single-source-of-truth map), `CONTRIBUTING.md`
  (enforcement table: owner · verify · failure · rollback · accepted exceptions), `.env.example`
  (honest: no runtime env vars).
- **CI**: `ci.yml` now also runs the duplication guard; the canonical suite runs via `npm test`.

Total suite: 131 tests green.

---

## [1.0.6] — 2026-07-04

### Fixed — TranscriptPage crash on missing grammar layer (+ closed a test blind spot)

- `TranscriptPage` called `window.HG.term()`/`.fill()` **unguarded**; if `hebrew-grammar.js`
  failed to load, the screen crashed (`Cannot read properties of undefined`). Now uses the
  guarded `hg()` + new `hgTerm()` utils (fall back to the raw term instead of throwing).
  Surfaced by the new coverage run.
- **Test blind spot closed:** the route-smoke + a11y suites passed even when a page crashed,
  because the error-boundary card renders inside `#main-content` and has its own `h1`. Tests now
  load `hebrew-grammar.js` (as `index.html` does) so HG-dependent code runs for real, and the
  route smoke test asserts the error-boundary fallback is **not** present.

### Added

- **Coverage** (`@vitest/coverage-v8`, `npm run test:coverage`) with 70% thresholds on the
  logic layer (utils/store/hooks/nav/data). Current: statements/lines **84.5%**, branches
  **71.5%**, functions **72%**. Wired into CI.
- **CI upgraded** (`.github/workflows/ci.yml`, replaces `security.yml`): now runs **lint** +
  **typecheck** + **tests with coverage** + **build** + **prod-dependency audit** on every push/PR.

---

## [1.0.5] — 2026-07-04

### Fixed — dark-mode color-contrast failure (WCAG 1.4.3)

- Dark-theme `--text-muted` (#7E90B6) on `--surface-2` was **4.26:1**, below the 4.5:1 AA
  threshold for normal text. Lightened to **#8496BA** (4.58:1 on surface-2, 5.47:1 on paper) —
  a barely-perceptible change. Updated both `tokens.css` and the `sensei-theme.js` mirror (parity).

### Added

- **Deterministic color-contrast audit** (`tests/contrast.test.ts`) computing WCAG contrast
  ratios from the design tokens for both themes — the one a11y rule axe/jsdom can't evaluate
  without layout. Covers body/label pairs (≥4.5:1) and large/UI pairs (≥3:1). 92 tests green.
  (The audit initially had a vacuous dark-theme parse — `color-scheme:dark` sits at the block
  start, not the end — which masked this very failure; fixed to parse the full block.)

---

## [1.0.4] — 2026-07-04

### Fixed — accessibility remediation across the app (found by expanded axe audit)

Expanding the axe suite from 7 screens to **all 26 routes + interactive overlays** surfaced 58
real WCAG violations the earlier assertion-based review missed. All fixed, behavior/visuals preserved:

- **`nested-interactive` (WCAG 4.1.2, serious)** — clickable rows containing action buttons
  (`.pat-row` on patients, `.notif-row` on notifications) restructured to the sibling-button
  pattern: the container is non-interactive, the primary click area is a reset-styled
  `<button>` that is a *sibling* of the action buttons. Full mouse + keyboard preserved;
  `stopPropagation` on the action buttons still works.
- **`aria-toggle-field-name` (12×)** — the avatar-color swatches (`role="radio"`) had no
  accessible name; added descriptive Hebrew `aria-label`s.
- **`heading-order`** — cards/sections jumping `h1 → h3` (resources, upload) corrected to
  `h2` (tag/level only; inline font styling unchanged).
- **`label`** — the upload date input gained an `aria-label` from its visible label.

### Tests

- Accessibility suite now covers **all 26 routes + auth + command palette + create dialog**
  (`tests/a11y.test.tsx`). Full suite: **88 tests green, stable.**

---

## [1.0.3] — 2026-07-04

### Fixed — real accessibility bug (found by automated axe audit)

- **`nested-interactive` (WCAG 4.1.2, serious)** on the dashboard's today's-schedule rows: the
  store's a11y auto-promotion wrapped a clickable row that contains an inner upload button in
  `role="button"`, nesting two interactive controls. The promotion now skips containers that
  hold (or sit inside) another interactive element. Row mouse-click behavior is preserved and
  the inner control stays keyboard-operable. (Previously claimed AA compliance was assertion-based;
  this was caught only once axe ran against real rendered content.)

### Added

- **Automated accessibility tests** (`tests/a11y.test.tsx`) — axe-core over 7 key screens
  (auth, dashboard, patients, settings, upload, tasks, notifications), 0 structural violations,
  wired into the suite. **66 tests green, stable across repeated full-suite runs.**

---

## [1.0.2] — 2026-07-04

### Changed — deduplication & canonicalization (behavior-preserving)

- **Single source of truth for shared logic + data.** Consolidated previously-duplicated
  per-file copies into canonical modules — net **−265 LOC**:
  - `src/utils/search.ts` — `normHe`, `scoreP` (unified `(p, q, tagsMap)` signature), `hlParts`
    (were duplicated across command palette, app-bar search, patients list, search page).
  - `src/utils/format.ts` — `relTime` (was in app bar + settings sync tab).
  - `src/utils/dedup.ts` — `buildDupClusters` (was in dedup page + merge dialog).
  - `src/data/catalogs.ts` — `RES` (with the `meta` superset that search previously dropped),
    `DOCS`, `NOTIFS` (removes a latent search↔page divergence bug).
  - `src/data/sessions.ts` — shared session seed (`SESSION_DATES`, `SESSION_TOPICS`,
    `sessionSummaries`, `sessionRisk`); the 5 per-screen session builders now derive from it
    while keeping their distinct projections.
- Removed dead code surfaced by the cleanup (unused `hg` imports) and fixed a `useEffect`
  ref-cleanup warning in the store.

### Added

- **ESLint** (flat config, `typescript-eslint` + `react-hooks`) + `npm run lint`
  (`--max-warnings=0`, passing). Focuses on real-bug rules; `any`/inline-styles allowed (ported debt).
- **CSP + security headers** for deployment: `vercel.json` and `public/_headers` (Netlify) —
  `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (React inline styles), `connect-src 'self'`,
  `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy. Verified
  compatible with the built output (no inline scripts).

### Tests

- Added `tests/searchUtils.test.ts` (normHe/scoreP/hlParts/relTime). Suite: 59 green.

---

## [1.0.1] — 2026-07-04

### Fixed — production-readiness pass

- **Added a page-level error boundary** (`src/components/shared/ErrorBoundary.tsx`) wrapping the
  route render in `App.tsx`. A render error in one screen now shows a recoverable Hebrew alert
  card instead of white-screening the whole app; it self-clears on navigation. Previously any
  page-render throw would crash the entire app.
- **Fixed horizontal overflow on mobile** (`src/styles/global.css`): the off-canvas nav drawer
  (`position:fixed; translateX(105%)`) created ~80px of phantom horizontal scroll in RTL.
  `html, body { overflow-x: hidden }` removes it; verified the sticky app bar, vertical scroll,
  and drawer open/close are unaffected across mobile/tablet/desktop.
- **Added `@types/node`** + `tsconfig` `types: ["node", …]` so `tsc` (and `npm run build`) pass
  with the Node-based security tests present.

### Tests

- Added `tests/errorBoundary.test.tsx` (3 tests: catches a throw, recovers on resetKey change,
  passes children through). Added 2 network/tabnabbing static guards to `tests/security.test.ts`.
  Suite: 50 tests green.

---

## [1.0.0] — 2026-07-04

### Added — initial production React port of prototype spec v2.2.0

- Vite + React 18 + TypeScript scaffold, RTL Hebrew (`<html lang="he" dir="rtl">`), port 3110.
- Canonical token CSS (58 tokens × light/dark) + base styles verbatim from the spec.
- Global store porting the prototype logic: state patches, debounced localStorage session
  persistence, theme (light/dark/system) + accessibility appliers, global keyboard
  shortcuts (Escape cascade, ⌘K, `?`, `/`, `N`, `G`), online/offline awareness.
- `navConfig()` single source of truth (sidebar + ⌘K palette + global search) per the
  v2.2.0 navigation contract; added the missing `documents` entry to `ROUTE_TITLES`.
- All 26 content routes ported as lazy-loaded pages + 5 auth states.
- App shell: sidebar (off-canvas drawer on mobile), appbar with global search, sync menu,
  notifications popover, theme toggle, upload CTA; overlays: keyboard-shortcuts dialog,
  command palette, AI assistant, action dialogs (create/edit/delete/merge/wipe/goal/
  schedule), snackbar.
- Shared `Pager` component (port of `Pager.dc.html`) used by patients/sessions/documents.
- Gendered-Hebrew microcopy layer (`hebrew-grammar.js`, window.HG) bundled and typed.
- Vitest suite: utils (100%), navConfig contract, route smoke renders for all 26 routes
  + auth view.
