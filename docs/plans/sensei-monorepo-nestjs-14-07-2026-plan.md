# Plan — SENSEI Monorepo via /batch: NestJS API (port of senseiAPI) + React web, parallel worktree workers

## Execution outcome (2026-07-15) — [DONE]

**Phase A — Foundation** `[DONE]` — committed to `main` (`11ef77b`): trimmed template scaffold, 6 frozen entities + `0001_init.sql`, Zod env, cross-module seam tokens with no-op defaults, MOCK_MODE TEST_USER bypass, shared test factory, CI. Gate A (review/simplify/security) applied; 2 security hardenings folded in (prod JWT_SECRET always required; `@Exclude()` on `passwordHash`).

**Phase B — 8 parallel worktree units** `[DONE]` — all landed as PRs #1–#8, each green on CI, each through the `code-review` skill:
- U1 db-migration-runner (#3), U2 auth (#2), U3 patients (#5), U4 calendar (#4), U5 audio-transcription (#6), U6 summaries (#8), U7 reports (#7), U8 docs-dx (#1).
- A transient model outage killed the first two launch waves mid-startup (no commits lost); relaunched via a canary-then-fanout pattern.

**Phase C — Integration** `[DONE]` on `batch/integration` (off `main`):
- All 8 branches merged **clean, zero conflicts** (frozen-file discipline held).
- **C1 authorization sweep** `[DONE]`: background security reviews confirmed a systemic IDOR — audio/summaries/reports acted on `meeting_id`/`patient_id` with no ownership check. Fixed by scoping every meeting/patient-derived resource to `calendar_events.therapist_id` via `@CurrentUser` (404 for non-owners; reports never aggregate another therapist's summaries). Committed cross-therapist negative tests per module. No schema change needed.
- **C2 infra** `[DONE]`: shared Testcontainers Postgres via Jest `globalSetup` + per-suite `provisionDatabase()` — integration suite went from 991s (flaky container-start timeouts) to **~25s, deterministic**; `app-factory` gained a `DATABASE_URL` reuse path; **shipped `db/migrations` into the deploy bundle** (`files: ["dist","db"]` — was a prod-boot blocker); fixed `compose.yaml` pg18 volume path.
- **C3 web wiring** `[DONE]`: `apps/web/.env.example` documents the local API URL. Integrated path proven with a live MOCK_MODE smoke — form-urlencoded demo login, whoami, seeded patients/calendar, summary 200, CORS 204 for `:3110`, and the IDOR fix holding live (therapist B → 404).
- **C4 Gate B holistic review** `[DONE]`: seam-coherence finder clean (all 11 cross-module tokens wired, no cycles, MOCK_MODE consistent); infra finder found only CI-edge cases (applied the 2 highest-value: collision-free shared-URI env + guarded read, Dockerfile comment); **IDOR finder found 3 more real cross-therapist gaps, all fixed**:
  1. `patient_reports` was `UNIQUE(patient_id)` — two therapists sharing a patient could read/clobber each other's report. Fixed with **`0002_patient_reports_per_therapist.sql`** (adds `therapist_id`, composite unique `(patient_id, therapist_id)`, FK→users) + per-therapist scoping through the reports repo/service/mock; new int test proves B's report contains only B's content, A's row survives B's POST.
  2. `GET /audio` listed every stored file id unscoped → therapist B could enumerate + download A's retained raw audio. Removed the enumeration endpoint (unused by the SPA; by-id endpoints remain capability-protected by unguessable UUID).
  3. (400-vs-404 patient-existence oracle) — left as documented low-severity: patients are unowned and UUIDs unguessable.
- **Verification**: combined `turbo lint typecheck test build` green (**374 api unit + 358 web tests**); `test:int` **88/88 green** in ~25s.

**Deferred follow-ups (documented, not blockers):** committed Playwright e2e harness (new browser dep + CI job + dual-server orchestration — the live QA pass covers integrated journeys); env-tunable throttler limits; **patient-roster tenancy** — `patients` still has no per-therapist owner column (any authenticated therapist can list/edit any patient row via `/patients`); making the roster private-per-therapist (vs. a shared clinic roster) is a product decision needing a further migration adding `patients.therapist_id`. Reports and all meeting-derived resources are now therapist-scoped regardless.

## Context

Convert the Python `senseiAPI` (FastAPI) to **NestJS** in the fresh `SENSEI-MONOREPO` (github.com/RonMizrahi/SENSEI-MONOREPO), following `RonMizrahi/nestjs-service-template`, bring the React SPA (SENSEI repo, branch `new-ui`) in as `apps/web`, wire front↔back, keep mock mode at both layers, and manage schema via **versioned SQL scripts auto-run on boot** against **Supabase**. Previously planned as 7 sequential milestones; the user invoked **/batch** to replan for parallel execution (plan-guidelines strategy D).

**Research already done this session (summaries in coordinator context):**
- Template map: NestJS 11 + TypeORM/Postgres, Passport JWT + argon2id, Zod env, pino, Terminus, Helmet/CORS/throttler, Swagger, repository pattern, Testcontainers int tests, pnpm+Turbo monorepo with `packages/{typescript-config,eslint-config}`. Clone at `/private/tmp/claude-501/-Users-ronm-git-SENSEI/aab91345-b445-4e43-9f53-b58121865880/scratchpad/nestjs-service-template`.
- Python contract: 5 tables (users, patients, calendar_events, transcripts, meeting_summaries), routers auth/audio/calendar/patients/meetings, Hebrew summary prompt (`summaries/prompt.py`), ENABLE_SECURITY=false → TEST_USER bypass, startup sweep for stranded `running` summaries.
- Frontend contract: exact paths/types in `/Users/ronm/git/SENSEI/src/services/*` (table below); demo mode via unset `VITE_API_BASE_URL`; auto-registers `rotem@clinic.co.il/demo1234` via `/auth/register` + urlencoded `/auth/token`.

**Confirmed decisions (unchanged):** SQL migrations + auto-run with `_migrations` tracking; ElevenLabs transcription + Anthropic Claude summaries (interfaces + mocks); `MOCK_MODE=true` in-memory API; pnpm + Turborepo; Node 24 (v24.18.0 + pnpm 11.11.0 + gh + Docker all verified locally).

**State right now:** M0 scaffold is copied but uncommitted in `/Users/ronm/git/SENSEI-MONOREPO` (template root + packages/* + trimmed `apps/api` + `apps/web` from new-ui; root package.json/README/compose written; api package.json trimmed). Remaining trim edits (app.module, env schema, users/health/tests) fold into Phase A.

## Why a foundation phase (the decomposition problem)

The API modules all touch shared files: `app.module.ts`, entities, env schema, `package.json` (deps → lockfile), auth guards, test bootstrap. Parallel workers editing those = merge-conflict soup. **Phase A commits a green foundation to `main` that owns ALL shared seams; each Phase B worker then owns exactly one directory** (plus its own `test/*.int-spec.ts` file) and touches nothing shared. Cross-module calls go through foundation-defined interfaces/tokens with no-op defaults, so the app compiles and boots (in MOCK_MODE) from the foundation commit onward, and every worker replaces only its own implementation.

---

## Target API contract (frontend wins — no URI versioning) — THE spec for all workers

| Frontend call | NestJS endpoint | Notes vs Python |
|---|---|---|
| `POST /auth/register` `{email,password,full_name}` | 201/409 | parity |
| `POST /auth/token` (**form-urlencoded** `username`/`password`) → `{access_token, token_type:"bearer"}` | 200/401 | urlencoded, not JSON |
| `POST /auth/logout` → 204 | `token_version++` revocation | |
| `GET /auth/whoami` → `{user_id,email,full_name}` | | |
| `POST /auth/password/change` → 204 | verifies current, bumps token_version | |
| `GET /patients` (+`?archived=true`) | **NEW**: `archived` column + filter | ordered created_at DESC |
| `POST /patients` `{name,phone,email?}` → 201 | accepts `email: null` | |
| `PATCH /patients/{id}` | **NEW**: also `name`, `archived` | 404 when absent |
| `DELETE /patients/{id}` → 204 | | |
| `GET/POST/PATCH/DELETE /calendar` (+`?time_zone=Asia/Jerusalem`, `from`/`to` YYYY-MM-DD) | `therapist_id` from JWT user (**fix** Python FAKE_ID); default = current week Sun–Sat; ±6d one-sided; 365d cap; half-open interval; store UTC, return in tz | shape: `{id,title,description,start_at,end_at,created_at,therapist_id,patient_id}` |
| `POST /audio/upload` multipart (`file`,`patient_id?`,`meeting_id`,`session_date?` ignored) → 201 `{id,filename,content_type,size_bytes,language,text,meeting_id,transcript_id}` | 400 missing meeting / 404 patient-meeting / 409 transcript exists / 413 too large / 415 bad type | transcribe → persist transcript → queue summary |
| `GET /audio` → `[{id,size_bytes}]`; `GET/DELETE /audio/{id}`; `POST /audio/{id}/transcribe` | | |
| `GET /meetings/{id}/summary` → `{meeting_id,status,text,model,error}` | 200 ready/failed, **202** pending/running, 404 none | |
| `POST /meetings/{id}/summary` | **NEW** — (re)queue; frontend poller POSTs on 404/failed | |
| `GET+POST /patients/{id}/next-meeting-report` → `{patient_id,status,intro,changes[],open_topics[],source_meeting_ids[],last_summary_excerpt,generated_at,model,error}` | **NEW feature**: Claude aggregates the patient's ready summaries; pending→running→ready/failed | |
| `GET /` `{message}`, `GET /health` `{status:"ok"}`, `GET /ready` `{status,database:"ok"\|"unavailable"\|"mock"}` | `/ready` 503 when DB down | |

## Database schema (foundation-owned, `apps/api/db/migrations/0001_init.sql`)

`users` (id uuid PK, auth_type vc64, role vc64, email vc255 unique, full_name vc255 null, password_hash vc512, token_version int default 0, created_at tz); `patients` (id, name vc255, phone vc32, email vc255 null, **archived bool default false**, created_at); `calendar_events` (id, title vc255, description vc2000 null, start_at/end_at tz, created_at, therapist_id uuid **FK→users**, patient_id uuid null FK→patients, idx (therapist_id,start_at)+(therapist_id,end_at)); `transcripts` (id, meeting_id uuid **unique** FK→calendar_events CASCADE, raw_text text, diarized_segments jsonb default '[]', language vc16 default 'he', created_at); `meeting_summaries` (id, meeting_id unique FK CASCADE, status vc16 default 'pending', text null, model vc64 default '', error null, created_at, updated_at); `patient_reports` (id, patient_id **unique** FK→patients CASCADE, status, intro text null, changes jsonb, open_topics jsonb, source_meeting_ids jsonb, last_summary_excerpt text null, generated_at tz null, model vc64 default '', error null, created_at, updated_at).

## API env (foundation-owned, Zod fail-fast; all optional in MOCK_MODE)

`NODE_ENV, PORT(3000), CORS_ORIGINS(http://localhost:3110), LOG_LEVEL, SWAGGER_ENABLED, DATABASE_URL, MOCK_MODE(false), JWT_SECRET(≥32), JWT_EXPIRES_IN(30d), UPLOAD_DIR(uploads), MAX_UPLOAD_BYTES(26214400), ELEVENLABS_API_KEY?, ELEVENLABS_MODEL(scribe_v2), TRANSCRIBE_LANGUAGE(he), SUMMARY_ENABLED(true), ANTHROPIC_API_KEY?, SUMMARY_MODEL(claude-haiku-4-5), MAX_TRANSCRIPT_CHARS(40000)`. Supabase: `sslmode=require`; README documents pooler 5432 vs 6543.

---

## Phase A — Foundation (coordinator, sequential, lands on `main`)

Finish + extend the in-flight M0 scaffold; commit + push to `main` only when fully green. Contains **every shared seam**:

1. Finish template trim (in progress): app.module (drop Caching/External/Observability/OTel-in-logger; TypeORM `migrationsRun:false`, no migrations glob), main.ts (drop Kafka), app.setup.ts (**remove URI versioning**, retitle Swagger "Sensei API"), users.service/controller/module (drop cache+bus), health (DB-only readiness), Dockerfile (drop tracing preload), .env.example rewrite, int-test URL fixes (`/v1/x` → `/x`), delete `app.int-spec.ts` metrics test.
2. `apps/web` already copied; rename pkg `@sensei/web`, drop netlify.toml/vercel.json (deploy configs of the old repo).
3. **Full env schema** (list above) + `.env.example`.
4. **All 6 TypeORM entities** + `db/migrations/0001_init.sql` (spec above). Entities are foundation-frozen — workers never edit them.
5. **All api deps added now** (lockfile freeze): `@anthropic-ai/sdk`, `luxon` + `@types/luxon`, `@types/multer`. No worker touches package.json/pnpm-lock.
6. **Module skeletons wired in app.module** — `db/`, `auth/` (reworked skeleton: User entity moved in, template users module deleted, guards/strategies compiling, TEST_USER bypass in MOCK_MODE so workers' e2e needn't wait for auth), `patients/`, `calendar/`, `audio/`, `transcripts/`, `summaries/`, `reports/`, `mock/` (shared seed data: rotem user, 4 patients, week of events). Each skeleton: module + controller stub returning 501 or minimal + empty providers, so boot is green.
7. **Cross-module seams (tokens + interfaces, no-op defaults):** `TRANSCRIPTION_PROVIDER` (transcribe(buffer,mime)→{text,language,words}), `SUMMARIZER` (summarize(text)→{text,model}), `SUMMARY_QUEUE` (enqueue(meetingId)), `TRANSCRIPT_READER` (getByMeetingId). `provideMockSwappable(token, RealClass, MockClass)` helper reading MOCK_MODE. JWT payload interface finalized (`sub,email,full_name,auth_type,role,token_version,iat,exp`).
8. **Shared test bootstrap** `test/utils/app-factory.ts`: Testcontainers Postgres + full Nest app + register/login helper returning a Bearer token; and a MOCK_MODE app factory.
9. CI workflow (adapted template: verify job lint/typecheck/test/build + test:int; e2e job deferred to Phase C).
10. Gate: `pnpm turbo lint typecheck test build` green; boot check `MOCK_MODE=true` → `/ready` 200. **code-quality-pipeline Gate A on adapted files.** Commit → push `main`.

## Phase B — Parallel work units (worktree agents, one PR each)

8 units; each owns ONLY the listed paths (plus its own new `test/<unit>.int-spec.ts` and `src/**` spec files inside its dirs). All build on the foundation commit. Roughly uniform (U5 largest, U8 smallest).

| # | Unit | Owns | Change |
|---|---|---|---|
| 1 | `db-migration-runner` | `apps/api/src/db/**`, `apps/api/test/db.int-spec.ts` | SQL runner: `_migrations` table, sorted `db/migrations/*.sql`, per-file transaction, boot hook (skip in MOCK_MODE), `db:migrate` standalone entry (bin script file inside src/db; foundation pre-registered the npm script) |
| 2 | `auth` | `apps/api/src/auth/**`, `apps/api/test/auth.int-spec.ts` | Full contract endpoints incl. urlencoded `/auth/token`; argon2id; token_version revocation checked in JwtStrategy; mock user store impl (seeded rotem) |
| 3 | `patients` | `apps/api/src/patients/**`, `apps/api/test/patients.int-spec.ts` | CRUD + archived filter/updates; real TypeORM repo + seeded mock repo |
| 4 | `calendar` | `apps/api/src/calendar/**`, `apps/api/test/calendar.int-spec.ts` | CRUD, tz handling (Luxon), week defaults/caps, therapist scoping from JWT; real + mock repos |
| 5 | `audio-transcription` | `apps/api/src/audio/**`, `apps/api/src/transcription/**`, `apps/api/src/transcripts/**`, `apps/api/test/audio.int-spec.ts` | Multipart upload (validation matrix 400/404/409/413/415), file store in UPLOAD_DIR, ElevenLabs + mock `TRANSCRIPTION_PROVIDER` impls, transcript persistence, enqueue via `SUMMARY_QUEUE` token, `TRANSCRIPT_READER` real impl |
| 6 | `summaries` | `apps/api/src/summaries/**`, `apps/api/test/summaries.int-spec.ts` | `SUMMARIZER` impls (Anthropic + mock), `SUMMARY_QUEUE` real impl (in-process async, errors → row), lifecycle pending→running→ready/failed, startup sweep, `GET+POST /meetings/{id}/summary` (202 semantics), Hebrew prompt ported verbatim from `senseiAPI/summaries/prompt.py` |
| 7 | `reports` | `apps/api/src/reports/**`, `apps/api/test/reports.int-spec.ts` | next-meeting-report: aggregate patient's ready summaries (query meeting_summaries entity directly), Claude prompt → intro/changes/open_topics, patient_reports lifecycle + sweep, `GET+POST /patients/{id}/next-meeting-report` |
| 8 | `docs-dx` | `README.md`, `CLAUDE.md` (root, new, <100 lines), `docs/**`, `apps/api/.env.example` polish | Quickstart (mock/local-pg/Supabase), architecture one-pager, env reference. No src changes |

**Conflict guarantees:** entities/env/deps/app.module/guards/test-utils = foundation-frozen (workers may READ, never edit). Each unit's controllers live in its own dir (routes were NOT pre-stubbed into other dirs). If a worker believes a shared file must change, it notes it in the PR description instead of editing — coordinator handles in Phase C.

**Testing per unit (testing-standards):** unit = breadth (every branch/validation/edge, alongside code); integration = per endpoint 1 happy + 2–3 key failures asserting **response shape** (zod is available), not permutations; ≥1 happy path per endpoint at both levels; random UUIDs/emails only. Run scoped: `pnpm --filter api test -- --testPathPatterns=<dir>` and `pnpm --filter api test:int -- --testPathPatterns=<unit>`.

## E2E test recipe (workers execute autonomously)

API units (1–7):
```bash
pnpm install --frozen-lockfile   # worktree is fresh
pnpm --filter api build          # must be green
MOCK_MODE=true PORT=3456 node apps/api/dist/main &   # boot real bundle
sleep 2 && curl -sf http://localhost:3456/ready       # expect 200
TOKEN=$(curl -sf -X POST http://localhost:3456/auth/token -H 'content-type: application/x-www-form-urlencoded' --data 'username=rotem@clinic.co.il&password=demo1234' | jq -r .access_token)  # after U2 lands, foundation TEST_USER bypass covers pre-U2 workers: protected routes accept no token in MOCK_MODE
# curl the unit's OWN endpoints: happy path + one key failure, assert JSON fields with jq
kill %1
```
Unit 1 (db-runner) additionally: `docker compose up -d postgres` (repo compose.yaml) → boot with real `DATABASE_URL=postgres://app:app@localhost:5432/app` → assert `_migrations` has `0001_init.sql` row and re-boot no-ops. Unit 8 (docs): **skip e2e — docs only**, verify with `pnpm lint` at root.

## Worker prompt template (given verbatim to each agent, + its unit row and contract/schema sections above)

```
You are one of 8 parallel workers building the Sensei NestJS API in an isolated worktree of
github.com/RonMizrahi/SENSEI-MONOREPO. The full spec is committed at
docs/plans/sensei-monorepo-nestjs-14-07-2026-plan.md — READ IT FIRST. Your unit: <row>.
OWNERSHIP RULE: edit ONLY your owned paths. Entities, env schema, app.module, package.json,
pnpm-lock, guards, test/utils are FROZEN — read them, never edit; if one must change, write it
in the PR description instead.
Conventions (nestjs-backend-standards): controllers dispatch-only; services never touch TypeORM
directly — a {feature}.repository.ts owns queries; request+response DTOs are CLASSES with
class-validator + @ApiProperty; full Swagger decorators per endpoint; JSDoc ≤3 lines on every
function; no `as`/`any`/magic numbers; ConfigService only (never process.env).
Testing (testing-standards): unit tests = breadth alongside code; integration = 1 happy + 2–3
key failures per endpoint asserting response SHAPE; random UUIDs/emails; use test/utils/app-factory.
Branch: batch/<unit-name>. Base: main (foundation commit).

After you finish implementing the change:
1. **Code review** — Invoke the `Skill` tool with `skill: "code-review"` to find correctness bugs (it reports findings; it does not edit code). Fix any findings it surfaces before continuing.
2. **Run unit tests** — Run the project's test suite (check for package.json scripts, Makefile targets, or common commands like `npm test`, `bun test`, `pytest`, `go test`). If tests fail, fix them.
3. **Test end-to-end** — Follow the e2e test recipe from the coordinator's prompt (below). If the recipe says to skip e2e for this unit, skip it.
4. **Commit and push** — Commit all changes with a clear message, push the branch, and create a PR with `gh pr create`. Use a descriptive title. If `gh` is not available or the push fails, note it in your final message.
5. **Report** — End with a single line: `PR: <url>` so the coordinator can track it. If no PR was created, end with `PR: none — <reason>`.
```

## Phase C — Integrate (coordinator, after PRs land)

1. Review + merge the 8 PRs (green CI; independent, any order). Remove foundation no-op providers replaced by real impls if any remained; resolve any "frozen file" change requests from PR descriptions.
2. On `batch/integration` branch: wire `apps/web/.env.example` → `VITE_API_BASE_URL=http://localhost:3000`; run web against MOCK_MODE api; fix residual contract gaps API-side; **committed Playwright e2e journeys** in `apps/web/e2e/` (login → calendar; patients CRUD+archive; upload → summary poll → prep report) wired into CI's e2e job; full-stack Playwright-MCP acceptance pass; Supabase real-mode boot check (migrations apply, `/ready` ok) if creds provided.
3. **Gate B holistic review (code-quality-pipeline)** on the integration diff → PR.
4. Close-out (plan-guidelines Phase 3): statuses into this plan file, root CLAUDE.md finalized, claude-md-improver.
5. **QA handover (qa-engineer)**: running stack, plan file, endpoint list, demo creds + second registered identity; gate on verdict; findings → committed tests.

## Verification (end-to-end)
1. Root `pnpm turbo lint typecheck test build` + `test:int` green.
2. `MOCK_MODE=true` api + web dev → full SPA flows work against :3000.
3. Real Postgres boot: `0001_init.sql` applied once, re-boot no-op, `/ready` `{"database":"ok"}`.
4. Contract table returns documented statuses (curl smoke).

## Notes / risks
- Foundation is the biggest single chunk (~step 1–9) but is exactly what buys conflict-free parallelism; it reuses the already-copied scaffold.
- 8 concurrent Testcontainers runs share one Docker daemon — fine (random ports), just heavy; workers scope int tests to their own file.
- Old repos untouched; Render deployment replacement is out of scope.
- In-process background jobs + startup sweep (Python parity); BullMQ is a documented follow-up.
