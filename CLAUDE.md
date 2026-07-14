# CLAUDE.md — working guidance for the Sensei monorepo

Orientation for an AI/human contributor. Read this, then `README.md` (run modes +
API surface). History and decisions live in `docs/plans/`; a one-page architecture
reference lives in `docs/architecture/`.

## What this is

A pnpm + Turborepo monorepo for **Sensei**, an AI-assisted therapist
practice-management tool:

- **`apps/api`** — NestJS 11 backend (port of the Python `senseiAPI`): JWT auth,
  patients, calendar, audio upload → transcription (ElevenLabs) → Hebrew AI
  summaries + next-meeting reports (Anthropic Claude). TypeORM over PostgreSQL
  (Supabase in production, Docker `compose.yaml` locally).
- **`apps/web`** — `@sensei/web`, the Hebrew-only RTL React 18 + Vite SPA. It has
  **its own binding rules** — read `apps/web/CLAUDE.md` before touching it; those
  rules (Hebrew-only, logical CSS, token colors, canonical-home guards) are not
  repeated here.
- **`packages/typescript-config`**, **`packages/eslint-config`** — shared presets
  consumed as `@repo/*` workspace deps.

Node ≥ 24, pnpm ≥ 11. Docker is needed for local Postgres and integration tests.

## Commands (all must stay green)

```bash
pnpm install
pnpm turbo run lint typecheck test build   # the CI gate
pnpm --filter api test:int                 # Testcontainers integration tests (Docker)
MOCK_MODE=true pnpm --filter api start:dev # API on :3000, no DB/keys needed (Swagger /docs)
pnpm --filter @sensei/web dev              # SPA on :3110
```

## Architecture in one breath

SPA → controllers → services → repositories → Postgres. Three foundation seams
keep the modules decoupled:

1. **MOCK_MODE provider swapping.** `MOCK_MODE=true` swaps every DB/AI-backed
   provider for a seeded in-memory one via `provideMockSwappable`
   (`apps/api/src/common/mock-mode.ts`); seed data (demo therapist,
   patients, week of events) is in `apps/api/src/mock/seed.ts`. The API boots
   with zero external dependencies in this mode.
2. **Frozen entities + SQL-scripts-only schema evolution.** TypeORM entities map
   the schema but never create it (`synchronize: false`, `migrationsRun: false`).
   The schema evolves ONLY via ordered SQL files in `apps/api/db/migrations/`,
   applied on boot and tracked in a `_migrations` table. New schema change =
   new numbered `.sql` file; never edit an applied one.
3. **Cross-module tokens.** Modules talk through injection tokens with
   interfaces, not direct imports: `TRANSCRIPTION_PROVIDER`
   (`src/transcription/`), `SUMMARIZER` + `SUMMARY_QUEUE` (`src/summaries/`),
   `TRANSCRIPT_READER` (`src/transcripts/`). Depend on the token, not the class.

Config is Zod-validated fail-fast at boot — `apps/api/src/config/env.schema.ts`
is the single source of truth for env vars (`.env.example` mirrors it). Read
config via `ConfigService` only, never `process.env` (sole exception:
`isMockMode()` at module-composition time).

## Binding conventions

- **The frontend contract wins.** Routes are **unversioned** (no `/v1`) and JSON
  is **snake_case** — exactly what `apps/web/src/services/*` sends and expects.
  Never rename a field or path to look more idiomatic; the SPA is the spec.
- **Layering (api):** controllers dispatch-only; services hold logic and never
  touch TypeORM directly — a `{feature}.repository.ts` owns queries. DTOs are
  classes with class-validator + `@ApiProperty`; every endpoint carries full
  Swagger decorators.
- **New behavior ships with tests** — unit specs alongside code, integration
  specs in `apps/api/test/*.int-spec.ts` (shared bootstrap:
  `apps/api/test/utils/app-factory.ts`).
- **Dependencies are deliberate.** Adding to any `package.json` changes the
  frozen lockfile — do it consciously, and keep `pnpm-workspace.yaml`
  `allowBuilds` in mind for native deps.
- **No secrets in `VITE_*`** — Vite inlines them into the browser bundle. The
  web app reads only `VITE_API_BASE_URL`.

## Where things are decided

- `docs/plans/` — the build plan (parallel-unit ownership, API contract table,
  schema spec) and future plans.
- `docs/architecture/` — current-state architecture reference.
- `apps/web/CLAUDE.md`, `apps/web/ARCHITECTURE.md` — everything frontend.
