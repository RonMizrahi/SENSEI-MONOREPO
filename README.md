# SENSEI Monorepo

Sensei — AI-assisted therapist practice management.

| Workspace | What | Stack |
|---|---|---|
| `apps/api` | Backend API (port of the Python `senseiAPI`) | NestJS 11 · TypeORM · PostgreSQL (Supabase) · JWT |
| `apps/web` | Hebrew-only RTL SPA | React 18 · TypeScript · Vite |
| `packages/typescript-config` | Shared tsconfig presets | — |
| `packages/eslint-config` | Shared ESLint flat config | — |

## Quickstart

Requires **Node ≥ 24** and **pnpm ≥ 11** (`corepack enable`).

```bash
pnpm install
pnpm build          # turbo: build everything
pnpm lint && pnpm typecheck && pnpm test
```

Run locally:

```bash
# API (needs Postgres — `docker compose up -d postgres`, or a Supabase DATABASE_URL)
pnpm --filter api start:dev        # http://localhost:3000  (Swagger: /docs)

# Web (demo mode — no backend needed)
pnpm --filter @sensei/web dev      # http://localhost:3110
```

To point the web app at the API, set `VITE_API_BASE_URL=http://localhost:3000`
in `apps/web/.env` and restart the dev server.

Schema migrations are versioned SQL scripts in `apps/api/db/migrations/`,
auto-applied on API startup (tracked in a `_migrations` table). See
`docs/plans/` for the build plan and architecture decisions.
