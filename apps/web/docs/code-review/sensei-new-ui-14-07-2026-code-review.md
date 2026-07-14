# Code review — new-ui (web + mobile) · Gate A (per-file)

Branch `new-ui`. Six `feature-dev:code-reviewer` agents run in parallel, one per
logical module. Findings and resolutions below. (`security-review` tool not
installed in this environment — Step 3 done as a manual pass; noted, not
tool-verified.)

## Confirmed findings & fixes

| # | Sev | File | Finding | Fix |
|---|-----|------|---------|-----|
| 1 | Critical | `src/pages/DashboardPage.tsx` | All-day fixture events (`evt-909`) run through the timed-grid math → negative `top`, ~1293px height, overlaps header; also mislabeled "weekly". | Filter `!e.allDay` out of the day-column loop. |
| 2 | Medium | `src/pages/DashboardPage.tsx` | Prev/next chevrons inconsistent with the shipped `CalendarPage` (‹=prev, ›=next). | Flipped: ‹ → `shiftWeek(-1)` (prev), › → `shiftWeek(+1)` (next), aria-labels swapped. |
| 3 | Critical | `src/components/mobile/MobileDayView.tsx` | Date strip anchored to `weekStart(today)`, so month-picker jumps desync the strip (no highlighted day; tapping teleports back). | Anchor strip to `weekStart(selectedDate)`. |
| 4 | Important | `src/components/mobile/MobileDayView.tsx` | Bottom sheets are `role="dialog" aria-modal="true"` but lack the project's `useFocusTrap` (focus escapes; not restored). | Added `useFocusTrap` ref to both sheet containers (also applied to `MobileRecording`). |
| 5 | Critical | `src/components/mobile/MobileApp.tsx` | Recording overlay (local state) not cleared on route change → stays mounted over a new screen after Back/deep-link. | `useEffect(() => setRecording(null), [route])`. |
| 6 | Critical | `src/components/mobile/MobileApp.tsx` | `openRecording` fell back to `S.patientId` when the appt had no linked patient → misattribution. | Store `pid` as-is (unlinked ''), no fallback. |
| 7 | Important | `src/components/mobile/MobileApp.tsx` | Comment wrongly credited `shell.css` for the drawer rules (they live in `tokens.css`). | Comment corrected. |
| 8 | Critical | `src/components/mobile/MobilePatient.tsx` | `total = SESSION_DATES.length` (8) ≠ canonical `demoSessionCount(cp)` (7 for p1) → top row navigates to nonexistent session 8 → SessionDetail renders `undefined`. | Use `demoSessionCount(cp)`. |

## Reviewed clean
- `src/hooks/useIsMobile.ts`, `useWeekEvents.ts`, `useAudioRecorder.ts` (pause/resume),
  `src/data/sessionCategories.ts`, `src/data/reportContent.ts` — no defects (layering,
  tokens, memo keying, timer safety all verified).
- `src/services/calendar.ts` (fixture-removal fix + `eventGuestName`) and
  `src/pages/ReportPage.tsx` refactor — clean, API mode unchanged, no dead refs.

## Out-of-scope notes (not fixed — pre-existing)
- `getPatient` (`src/utils/index.ts`) falls back to `patients[0]` on an unknown id
  (could render an orphaned appt under the wrong name). Pre-existing utility behavior.
- `mergeCalendarEvents` (non-unique) now has no production call site (test-only) — pre-existing.
