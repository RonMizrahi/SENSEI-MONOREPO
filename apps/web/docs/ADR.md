# Architecture & Design Decision Records — Sensei Frontend

Short records of the decisions that shape the frontend, including the shipped
answers to the screen-spec's open questions. Format: context → decision →
consequence. Newest additions at the bottom. Details: [ARCHITECTURE.md](../ARCHITECTURE.md).

## ADR-001 · Client-only build with a dormant typed API layer
**Context.** Hackathon demo; backend (transcription/LLM/RBAC/storage) out of scope.
**Decision.** Ship a production-quality frontend on seeded data + `localStorage`,
with a canonical typed `src/services/` layer that activates via `VITE_API_BASE_URL`.
**Consequence.** Honest demo today; screen-by-screen backend wiring later without
rearchitecting. Demo data stays isolated and labeled.

## ADR-002 · State-driven routing with a URL-hash mirror (no router lib)
**Context.** 23 routes, auth states, overlays; zero-dependency preference.
**Decision.** A single `route` key in the store, mirrored to `location.hash`
(`src/nav/urlHash.ts`). Deep links set the route only — never the view — so a URL
cannot bypass sign-in. Dialogs/palette/overlays stay state-only.
**Consequence.** Deep-linkable, refresh-safe, Back-button-correct, trivially
testable; no router dependency to version.

## ADR-003 · Hebrew-only + logical CSS properties, both CI-guarded
**Context.** RTL product; mixed-direction bugs are regression-prone.
**Decision.** Hebrew-only copy (plural voice, no emoji) and *only* logical CSS
direction properties; both enforced by canonical guards. Technical strings are
`dir="ltr"` inline.
**Consequence.** RTL correctness can't silently regress; copy stays consistent.

## ADR-004 · Calm blue-family semantic palette
**Context.** Clinical tool; red alarm colors read as emergency and erode calm.
**Decision.** Success/warning/error map to a blue-family ramp (tokens.css), with
meaning carried by wording + iconography + placement, not hue alone.
**Consequence.** Calmer product; requires explicit copy for severity (also a
color-blind-safe posture). Contrast is audit-verified in both themes.

## ADR-005 · Prep report is a separate screen (spec open question 2.4)
**Context.** Spec asked: prep report inside the calendar's event dialog, or apart?
**Decision.** A button that navigates to the dedicated report screen; the event
dialog stays a compact hub (details/edit · open file · prep).
**Consequence.** Clean dialog, one canonical report screen for all entry points.

## ADR-006 · Session History screen kept as a patient directory (spec §4)
**Context.** Spec suspected the screen was redundant.
**Decision.** Keep it as `HistoryDirectory` — all patients (active + archived),
A–Z + search — opening the same `SessionHistoryView` used inside the patient file.
**Consequence.** One shared history view (no duplication); a fast "find any
patient's history" path that the per-file route doesn't serve.

## ADR-007 · Between-session notes are a dated, append-only timeline (spec 3.6)
**Context.** Spec left placement open (timeline / separate tab / attach-to-session).
**Decision.** A timeline card in the patient file: dated entries, newest first,
per-entry delete; the legacy single-blob note migrates non-destructively
(`src/utils/therapistNotes.ts`). Draft-recovery and the home "resume work" card
keep working through `notesDrafts`.
**Consequence.** Observations accumulate with temporal context; no lost notes.

## ADR-008 · TTS is browser-native (Web Speech), feature-detected
**Context.** Backend TTS wasn't in development; spec deferred per-session TTS.
**Decision.** Implement all recap playback (daily, per-session, per-patient) on
`speechSynthesis` via one `useTts` hook; controls render only when supported.
**Consequence.** The 🟢 spec items ship with zero backend; no dead buttons where
the API is absent (e.g., some embedded browsers).

## ADR-009 · Permanent delete purges all patient references atomically
**Context.** Pid-keyed collections (appointments, notes, docs, transcripts…)
could orphan after a hard delete, and orphans mis-resolved to the first patient.
**Decision.** A pure, idempotent `purgePatientReferences()` applied in the same
store patch as the delete, on both API and offline paths.
**Consequence.** Referential integrity is guaranteed and regression-tested; new
pid-keyed state must be added to the purge list (checklist in code comment).

## ADR-010 · Full TypeScript `strict` mode
**Context.** The port originated from an untyped prototype; strict was deferred
tracked debt.
**Decision.** Enable full `strict`; fix the (small) fallout behavior-preservingly.
**Consequence.** Null/any regressions now fail the build; the debt entry is gone.

## ADR-011 · Data ownership: export + validated restore of the persisted record
**Context.** localStorage-only app — clearing browser data (or switching devices)
lost everything; an export alone is a backup you can't use.
**Decision.** Settings › Profile exports the exact persisted record (pretty JSON,
UTF-8 BOM, dated filename) and restores it: file validated as a Sensei backup,
explicit replace-all confirmation, then written and rehydrated via a full reload
so the ONE startup restore path (normalization, migrations, reconciliation) runs.
**Consequence.** Real backup/restore + device-to-device transfer with no second
hydration code path to drift; foreign/corrupt files are rejected untouched.

## ADR-012 · Remote-load failures are visible and retryable; local truth still renders
**Context.** With a real API, a failed `/calendar` load rendered as an empty week
— "no meetings" and "the request failed" are different truths.
**Decision.** The shared week-events hook exposes `error` + `reload()`; both
shells render an inline alert strip with "ניסיון חוזר". Copy states honestly that
locally-scheduled appointments still render (only the remote layer failed).
Aborts are not errors; a successful retry clears the state.
**Consequence.** Backend integration needs no UX retrofit for failure states; one
failure model across desktop and mobile.
