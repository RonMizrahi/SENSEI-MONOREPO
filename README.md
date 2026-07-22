# SENSEI Monorepo

Sensei — AI-assisted therapist practice management. NestJS API (a port of the
Python `senseiAPI`) + Hebrew-only RTL React SPA, in one pnpm/Turborepo workspace.

## Workspaces

| Workspace                    | What                                                                      | Stack                                             |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/api`                   | Backend API — auth, patients, calendar, audio transcription, AI summaries | NestJS 11 · TypeORM · PostgreSQL (Supabase) · JWT |
| `apps/web`                   | Hebrew-only RTL SPA (`@sensei/web`)                                       | React 18 · TypeScript · Vite                      |
| `packages/typescript-config` | Shared tsconfig presets (`@repo/typescript-config`)                       | —                                                 |
| `packages/eslint-config`     | Shared ESLint flat config (`@repo/eslint-config`)                         | —                                                 |

## Prerequisites

- **Node ≥ 24**
- **pnpm ≥ 11** (`corepack enable`)
- **Docker** — for the local Postgres (`compose.yaml`) and for the API's
  integration tests (Testcontainers)

```bash
pnpm install
```

## Running locally — three modes

### 1. Mock mode (zero config — no database, no AI keys)

The API serves seeded in-memory demo data (the demo therapist, four patients,
a week of calendar events) that mirrors the SPA's own demo world:

```bash
# Terminal 1 — API on http://localhost:3000 (Swagger at /docs)
MOCK_MODE=true pnpm --filter api start:dev

# Terminal 2 — web on http://localhost:3110
pnpm --filter @sensei/web dev
```

Wire the SPA to the API by creating `apps/web/.env` (see
`apps/web/.env.example`), then restart the web dev server:

```
VITE_API_BASE_URL=http://localhost:3000
```

With `VITE_API_BASE_URL` unset, the SPA runs standalone on its own seed data —
no backend calls at all.

### 2. Local Postgres (Docker)

```bash
docker compose up -d postgres     # postgres://app:app@localhost:5432/app
pnpm --filter api start:dev       # defaults match the compose credentials
```

Copy `apps/api/.env.example` to `apps/api/.env` to override anything (JWT
secret, AI keys, ports). Schema lives in versioned SQL scripts under
`apps/api/db/migrations/*.sql`; the API's migration runner applies them in
order on boot and records each applied file in a `_migrations` table, so
re-boots are no-ops.

### 3. Supabase

Point `DATABASE_URL` at your Supabase Postgres — **`sslmode=require` is
mandatory**:

```
DATABASE_URL=postgres://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Pooler port matters:

- **5432 — session pooler.** One backend connection per client for the whole
  session. Use this for the API: the boot-time migration runner and TypeORM
  rely on session-level behavior.
- **6543 — transaction pooler.** Connections are shared per transaction;
  session state (prepared statements, advisory locks) doesn't survive between
  queries. Suited to short-lived/serverless clients, not this API.

On first boot against a fresh database the runner applies
`apps/api/db/migrations/*.sql` and tracks them in `_migrations` — no manual
schema setup needed.

## Commands

```bash
pnpm turbo run lint typecheck test build   # the CI gate — must stay green
pnpm --filter api test:int                 # API integration tests (Docker/Testcontainers)
pnpm --filter api start:dev                # API dev server, http://localhost:3000
pnpm --filter @sensei/web dev              # web dev server, http://localhost:3110
pnpm format                                # prettier across the repo
```

## API overview

All routes are **unversioned** — the SPA's request/response shapes (snake_case
JSON) are the contract. Interactive docs: **Swagger at `/docs`** (+ `/docs/json`).

| Area      | Endpoints                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Auth      | `POST /auth/register`, `POST /auth/token` (form-urlencoded), `POST /auth/logout`, `GET /auth/whoami`, `POST /auth/password/change`       |
| Patients  | `GET/POST /patients`, `PATCH/DELETE /patients/{id}` (incl. `?archived=true` filter)                                                      |
| Calendar  | `GET/POST/PATCH/DELETE /calendar` (`?time_zone=`, `from`/`to`; defaults to the current week)                                             |
| Audio     | `POST /audio/upload` (multipart) → transcription + queued summary; `GET /audio`, `GET/DELETE /audio/{id}`, `POST /audio/{id}/transcribe` |
| Summaries | `GET/POST /meetings/{id}/summary` (202 while pending/running)                                                                            |
| Reports   | `GET/POST /patients/{id}/next-meeting-report`; per-meeting: `GET /patients/{id}/meeting-reports`, `GET/POST /patients/{id}/meeting-reports/{meetingId}` |
| Assistant | `POST /assistant/chat` (streams a Vercel AI-SDK UI Message Stream); context: `GET /assistant/context/{patients,agenda,patient/{id}/cadence,patient/{id}/meetings}` |
| Health    | `GET /` (welcome), `GET /health` (liveness), `GET /ready` (readiness — 503 when the DB is down, `"mock"` in mock mode)                   |

Demo login (seeded in mock mode; the SPA auto-registers it against a real DB):
**`rotem@clinic.co.il` / `demo1234`**.

## More

- `CLAUDE.md` — contributor orientation (conventions, architecture in one breath)
- `docs/architecture/` — one-page architecture reference
- `docs/plans/` — build plan and architecture decisions
