# Backend Integration — senseiapi contract

The backend (`github.com/avitalg/senseiAPI`, FastAPI + PostgreSQL) is the
**single source of truth** for the API contract. This doc records the mapping,
the configuration switch, and every known contract gap — verified against the
backend source on 2026-07-18. Frontend seam details: ARCHITECTURE.md § Backend
integration; service code: `src/services/`.

## Switching from mock to live

One environment variable — no code changes:

```
VITE_API_BASE_URL=https://<backend-host>
```

Unset → the app runs fully on seeded demo data + localStorage (every service
checks `isApiConfigured()`). Set → `src/services/apiClient.ts` routes all calls
there (15s timeout, AbortSignal support, typed `ApiError` with `status`/`code`).
No other `VITE_*` variables are read; secrets never belong in `VITE_*` (values
are inlined into the public bundle). The backend must list the frontend origin
in its `CORS_ORIGINS`. Auth is Bearer-token (OAuth2 password flow) — no cookies,
so no CSRF surface; `credentials: 'omit'` everywhere.

## Server cache (React Query)

When the API is configured, **TanStack Query** caches live reads (patients roster,
calendar week / upcoming / past). Query keys live in `src/query/keys.ts`;
`queryFn`s call the existing `src/services/*` HTTP helpers (no duplicate `fetch`).
UI / routing / local drafts stay in `AppStore`. Demo mode leaves queries
`enabled: false` (or uses fixture paths inside calendar loaders). Mutations
invalidate `['patients']` or `['calendar']` after successful create/update/delete.

## Endpoint map (frontend ⇄ backend)

| Frontend service | Backend route | Notes |
|---|---|---|
| `apiAuth.ts` | `POST /auth/register` (201/409), `POST /auth/token` (form-urlencoded), `POST /auth/logout` (204, bumps token_version) | demo bootstrap registers + stores Bearer; logout is fired best-effort on sign-out |
| `patients.ts` | `GET/POST /patients`, `PATCH/DELETE /patients/{uuid}` | see gaps below |
| `calendar.ts` | `GET/POST /calendar`, `GET/PATCH/DELETE /calendar/{uuid}` | `from`/`to` = `YYYY-MM-DD`; `time_zone` query (default `Asia/Jerusalem`); responses localized to that zone |
| `upload.ts` | `POST /audio/upload` (multipart: `file`, UUID `patient_id?`, UUID `meeting_id`) | 201 returns transcript text; `meeting_id` required when the backend has a DB; 400/404/409/413 (25MB)/415 mapped to Hebrew messages |
| `meetingSummary.ts` | `GET /meetings/{uuid}/summary` | read-only; 202 while pending/running (polled), 200 `failed` carries `error`; 404 = no summary exists |
| `uploadQueue.ts` | (offline queue → replays `POST /audio/upload`) | IndexedDB-backed |

Health: `GET /health`, `GET /ready` exist server-side (not consumed by the UI).

## Contract gaps (backend blockers — reported, not worked around)

These are **not** frontend bugs; each has an honest client-side behavior until
the backend adds support:

1. **No archive lifecycle.** `PATCH /patients/{id}` accepts only `phone`/`email`
   (422 when neither is set). Archiving/restoring is therefore a client-side
   state (`archivePatient`/`restorePatient` are local transforms; the record
   stays on the server). Guarded by `tests/patients.test.ts`.
2. **Patient `name`/`address` not updatable.** Edits to them persist locally
   only and are merged into the PATCH response client-side.
3. **No list filtering/pagination.** `GET /patients` returns everything; the
   roster filters/sorts client-side.
4. **`/patients/{id}/next-meeting-report` does not exist.** The prep-report UI
   polls it when configured; a 404/405 on both GET and POST is treated as
   "route absent" (`code: NOT_AVAILABLE`) and the UI silently falls back to the
   local deterministic report.
5. **Re-upload clears transcript + summary.** `GET/DELETE /meetings/{id}/transcript`
   probes and removes the stored transcript (DELETE also clears the meeting
   summary) so a new recording can be uploaded. Upload "replace" and Summary /
   Transcript "מחיקה והעלאה מחדש" call DELETE first.
6. **Summary-only delete.** `DELETE /meetings/{id}/summary` removes the AI
   summary while keeping the transcript (regenerate via re-upload or POST).

## Conventions

- **IDs**: server ids are UUIDs; local/seed ids (`p1`…) never reach the API
  (UUID-guarded in `upload.ts`/`calendar.ts`).
- **Dates/times**: API dates are `YYYY-MM-DD` + ISO datetimes localized via the
  `time_zone` query param; all display formatting stays in `src/utils/dates.ts`
  (`DD/MM/YY`).
- **Errors**: non-2xx → typed `ApiError` (`status`, `code`, parsed `details`);
  UI states cover loading/empty/error/timeout/offline (offline uploads queue
  and replay).
- **Duplicate-request prevention**: in-flight calls are aborted on re-entry
  (AbortController per screen); calendar merges local + API events by slot key.
