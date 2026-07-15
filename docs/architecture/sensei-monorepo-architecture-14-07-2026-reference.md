# Sensei Monorepo — Architecture Reference (14-07-2026)

One-page current-state reference. Deeper history: `docs/plans/`. Frontend
internals: `apps/web/ARCHITECTURE.md`.

## Request flow

```
apps/web (React SPA, :3110)
   │  fetch via src/services/* — unversioned paths, snake_case JSON,
   │  Bearer JWT (dormant until VITE_API_BASE_URL is set)
   ▼
apps/api (NestJS, :3000)
   Controllers  — dispatch-only; DTO classes (class-validator) + Swagger (/docs)
   ▼
   Services     — business logic; config via ConfigService (Zod-validated env)
   ▼
   Repositories — one {feature}.repository.ts per module owns all queries
   ├─ real: TypeORM → PostgreSQL (local Docker compose / Supabase, sslmode=require)
   └─ mock: seeded in-memory stores (src/mock/seed.ts) when MOCK_MODE=true
```

- **Mode switch:** `provideMockSwappable(token, RealClass, MockClass)` in
  `apps/api/src/common/mock-mode.ts` binds each token to the real or mock
  implementation at module-composition time. In MOCK_MODE the app needs no
  database and no AI keys.
- **Schema:** TypeORM never synchronizes (`synchronize: false`,
  `migrationsRun: false`). Ordered SQL scripts in `apps/api/db/migrations/*.sql`
  are applied on boot by the api's migration runner and tracked in a
  `_migrations` table; entities only map the resulting schema. Six tables:
  `users`, `patients`, `calendar_events`, `transcripts`, `meeting_summaries`,
  `patient_reports`.
- **Auth:** Passport JWT (argon2id password hashes, `token_version` revocation).
  In MOCK_MODE a TEST_USER bypass authenticates requests without a token
  (`apps/api/src/auth/auth.constants.ts`), mirroring senseiAPI's
  `ENABLE_SECURITY=false`.
- **Health:** `GET /` welcome, `GET /health` liveness, `GET /ready` readiness —
  `database: "ok" | "unavailable" | "mock"`, 503 when the DB is down.

## AI pipeline

Provided by the api behind the endpoints below; each stage sits behind a
cross-module injection token with a mock counterpart, so the whole pipeline
runs (with canned output) in MOCK_MODE.

```
POST /audio/upload (multipart: file, meeting_id, patient_id?)
  → TRANSCRIPTION_PROVIDER   ElevenLabs Scribe (ELEVENLABS_MODEL, TRANSCRIBE_LANGUAGE)
  → transcripts row          raw_text + diarized_segments, unique per meeting
  → SUMMARY_QUEUE.enqueue    in-process async job (startup sweep re-queues stranded work)
  → SUMMARIZER               Anthropic Claude (SUMMARY_MODEL) — Hebrew clinical prompt
  → meeting_summaries row    status: pending → running → ready | failed
       ↳ read via GET /meetings/{id}/summary (202 while pending/running)

GET/POST /patients/{id}/next-meeting-report
  → aggregates the patient's ready summaries → Claude → patient_reports row
    (intro, changes[], open_topics[], source_meeting_ids[]; same status lifecycle)
```

Tokens and their homes: `TRANSCRIPTION_PROVIDER` (`src/transcription/`),
`TRANSCRIPT_READER` (`src/transcripts/`), `SUMMARIZER` + `SUMMARY_QUEUE`
(`src/summaries/`).

## Environment variables (source of truth: `apps/api/src/config/env.schema.ts`)

All have defaults or are optional, so MOCK_MODE boots with zero config.
Production fail-fast: `JWT_SECRET` is always required; `DATABASE_URL` is
required unless `MOCK_MODE=true`.

| Variable               | Default                                 | Notes                                                  |
| ---------------------- | --------------------------------------- | ------------------------------------------------------ |
| `NODE_ENV`             | `development`                           | `development` \| `production` \| `test`                |
| `PORT`                 | `3000`                                  |                                                        |
| `CORS_ORIGINS`         | `http://localhost:3110`                 | comma-separated allowlist; `*` disables credentials    |
| `LOG_LEVEL`            | `info`                                  | pino levels `fatal`…`trace`                            |
| `SWAGGER_ENABLED`      | `true`                                  | mounts `/docs` + `/docs/json`                          |
| `MOCK_MODE`            | `false`                                 | seeded in-memory data; no DB or AI keys needed         |
| `DATABASE_URL`         | `postgres://app:app@localhost:5432/app` | Supabase: `?sslmode=require`, session pooler port 5432 |
| `JWT_SECRET`           | dev-only value                          | min 32 chars; required in production                   |
| `JWT_EXPIRES_IN`       | `30d`                                   |                                                        |
| `UPLOAD_DIR`           | `uploads`                               | audio file store                                       |
| `MAX_UPLOAD_BYTES`     | `26214400`                              | 25 MiB; larger uploads → 413                           |
| `ELEVENLABS_API_KEY`   | — (optional)                            | real transcription only                                |
| `ELEVENLABS_MODEL`     | `scribe_v2`                             |                                                        |
| `TRANSCRIBE_LANGUAGE`  | `he`                                    |                                                        |
| `SUMMARY_ENABLED`      | `true`                                  | gate for the summary pipeline                          |
| `ANTHROPIC_API_KEY`    | — (optional)                            | real summaries/reports only                            |
| `SUMMARY_MODEL`        | `claude-haiku-4-5`                      |                                                        |
| `MAX_TRANSCRIPT_CHARS` | `40000`                                 | transcript truncation before summarization             |

## Parallel-unit ownership map

The api was built as a foundation commit plus 8 parallel units (full spec:
`docs/plans/sensei-monorepo-nestjs-14-07-2026-plan.md`). Shared seams —
entities, env schema, `app.module.ts`, package.json/lockfile, guards,
`test/utils/` — are foundation-frozen; each unit owns exactly its directories.

| Unit                  | Owns                                                | Delivers                                                                           |
| --------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `db-migration-runner` | `apps/api/src/db/**`                                | boot-time SQL runner, `_migrations` tracking, `db:migrate` CLI                     |
| `auth`                | `apps/api/src/auth/**`                              | `/auth/*` contract, argon2id, token_version revocation                             |
| `patients`            | `apps/api/src/patients/**`                          | `/patients` CRUD + archived filter                                                 |
| `calendar`            | `apps/api/src/calendar/**`                          | `/calendar` CRUD, Luxon tz handling, week defaults, JWT therapist scoping          |
| `audio-transcription` | `apps/api/src/{audio,transcription,transcripts}/**` | `/audio/*`, upload validation, ElevenLabs + mock providers, transcript persistence |
| `summaries`           | `apps/api/src/summaries/**`                         | summary queue + lifecycle, Anthropic + mock summarizers, `/meetings/{id}/summary`  |
| `reports`             | `apps/api/src/reports/**`                           | `/patients/{id}/next-meeting-report` aggregation                                   |
| `docs-dx`             | `README.md`, `CLAUDE.md`, `docs/**`                 | this documentation                                                                 |

Each unit also owns its `apps/api/test/<unit>.int-spec.ts` (Testcontainers
Postgres via the shared `test/utils/app-factory.ts`).
