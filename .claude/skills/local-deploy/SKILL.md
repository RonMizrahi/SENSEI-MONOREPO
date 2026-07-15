---
name: local-deploy
description: Runs the Sensei monorepo locally — validates tools, installs deps, and starts BOTH apps (NestJS API on :3000 + Vite React SPA on :3110) in one of three modes (mock / local Postgres / Supabase). Invoke whenever the user wants to run, start, deploy, spin up, or set up Sensei locally — "get sensei running", "start the app", "run the API and web", "spin up the stack", "how do I run this locally", or any question about run modes, ports, MOCK_MODE, hot reload, or the local Postgres.
---

# Sensei — Local Deploy & Debug

## Architecture

One **pnpm + Turborepo monorepo** — no repos to clone, no external service stack. Two apps run side by side, plus an optional local Postgres:

| Piece | Workspace | How to run | Port |
|---|---|---|---|
| **API** (NestJS 11) | `apps/api` | `pnpm --filter api start:dev` | **3000** (Swagger at `/docs`) |
| **Web** (React 18 + Vite, Hebrew RTL) | `apps/web` (`@sensei/web`) | `pnpm --filter @sensei/web dev` | **3110** |
| **Postgres** (DB mode only) | `compose.yaml` | `docker compose up -d postgres` | **5432** |

Everything lives under the repo root (`/Users/ronm/git/SENSEI-MONOREPO`). All commands run from there unless noted.

**The API has three run modes** — pick one in Step 3:

1. **Mock** — `MOCK_MODE=true`; seeded in-memory data, **no database, no AI keys**. Fastest; best for UI work and a first run.
2. **Local Postgres** — real DB in Docker (`postgres://app:app@localhost:5432/app`); schema auto-migrates on boot.
3. **Supabase** — hosted Postgres via `DATABASE_URL=...?sslmode=no-verify` (see Step 4 for why `no-verify`, plus the password-encoding + direct-vs-pooler gotchas).

The web app is independent of the API: with `VITE_API_BASE_URL` **unset** it runs standalone on its own seed data + localStorage (no backend calls). Set it to wire the SPA to the running API.

---

## Prerequisites

Check each in Step 1. On this machine these were all present at authoring time (Node v24.18.0, pnpm 11.11.0, Docker 29.6.1).

| Tool | Minimum | Needed for | Install |
|---|---|---|---|
| Node.js | ≥ 24 | everything | nvm / https://nodejs.org |
| pnpm | ≥ 11 | everything | `corepack enable` |
| Docker | running | **only** local-Postgres mode + `test:int` | Rancher/Docker Desktop |

Mock mode and Supabase mode need **no Docker**. Docker is only for run mode 2 and the Testcontainers integration tests.

---

## Execution Steps

### Step 1 — Validate tools

```bash
node --version    # ≥ 24
pnpm --version    # ≥ 11
docker info       # only if using local-Postgres mode
```

If Node or pnpm is missing, stop and tell the user (offer `corepack enable` for pnpm). If only Docker is missing, that's fine unless they want mode 2 — say so and offer mock mode instead.

### Step 2 — Install dependencies

```bash
pnpm install
```

Idempotent; skips if the lockfile is already satisfied. Run it once per fresh checkout or after a dependency change.

### Step 3 — Choose a run mode

Explain **why** the choice matters (it decides whether Docker/keys are needed), then ask:

> "How do you want to run the API?
> 1. **Mock** (recommended for a first run) — seeded in-memory data, no Docker, no AI keys. Instant.
> 2. **Local Postgres** — real database in Docker; schema auto-migrates on boot.
> 3. **Supabase** — point at a hosted Postgres you already have."

Default to **mock** if they just want to see the app. Proceed with the matching Step 4.

### Step 4 — Configure env (mode-dependent)

**Mock mode** — no API `.env` needed; `MOCK_MODE=true` is passed inline in Step 6. To wire the SPA to the API, create `apps/web/.env`:

```
VITE_API_BASE_URL=http://localhost:3000
```

(Leave it unset instead if the user just wants the standalone web demo — then skip the API entirely.)

**Local Postgres mode** — copy the API env template and start Postgres:

```bash
cp apps/api/.env.example apps/api/.env    # keep MOCK_MODE=false; DATABASE_URL already points at the compose DB
docker compose up -d postgres
```

Wait for health before starting the API (Step 5). Also set `apps/web/.env` → `VITE_API_BASE_URL=http://localhost:3000` to wire the SPA.

**Supabase mode** — in `apps/api/.env` set `DATABASE_URL`. Two host shapes work:

```
# Direct (verified working; host is IPv6-only — needs IPv6 on your network):
DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=no-verify
# Session pooler (IPv4, more portable; note the postgres.<ref> username):
DATABASE_URL=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify
```

Three things that will otherwise break the boot (all verified the hard way):
- **`sslmode=no-verify`, not `require`.** The current `pg-connection-string` treats `sslmode=require` as an alias for `verify-full`, which rejects Supabase's self-signed cert chain (`SELF_SIGNED_CERT_IN_CHAIN`). `no-verify` keeps the connection encrypted but skips chain verification — standard for Supabase in dev. TypeORM forwards this URL param to pg, so it takes effect.
- **URL-encode the password.** If it contains `@ # & : / ?` etc., percent-encode them (`@`→`%40`, `#`→`%23`, `&`→`%26`) or the URL parser mis-reads the password/host.
- **Port 5432 = session pooler** (not 6543, the transaction pooler) — the boot migration runner + TypeORM rely on session state.

> AI features (transcription, summaries) stay stubbed/disabled until `ELEVENLABS_API_KEY` / `ANTHROPIC_API_KEY` are set in `apps/api/.env`. The app runs fine without them; only audio→summary flows are inert. `MOCK_MODE=true` fakes these too.

### Step 5 — Start Postgres (local-Postgres mode only)

Check the port is free first — a stale Postgres on 5432 will collide:

```bash
lsof -nP -i :5432 | grep LISTEN   # if taken, ask the user before killing
docker compose up -d postgres
```

Wait until healthy before booting the API (the first boot runs the SQL migrations):

```bash
docker compose ps                 # postgres should show (healthy)
```

Schema evolves **only** via ordered files in `apps/api/db/migrations/*.sql`, applied on boot and tracked in a `_migrations` table — re-boots are no-ops, no manual setup.

### Step 6 — Start the API

Run in the background and **monitor the logs** (see Monitoring Rules). Pick the command for the mode:

```bash
# Mock mode:
MOCK_MODE=true pnpm --filter api start:dev
# DB / Supabase mode (reads apps/api/.env):
pnpm --filter api start:dev
```

Confirm success **positively**, not by absence of errors:

```bash
curl -s localhost:3000/health        # liveness → 200
curl -s localhost:3000/ready         # readiness → "mock" in mock mode; 503 if DB is down
```

Look for `Nest application successfully started` in the logs. Then tell the user: **"API up on http://localhost:3000 (Swagger at /docs) ✓"**

### Step 7 — Start the web SPA

Kill anything on 3110 first — Vite silently drifts to the next free port if it's busy, which breaks the API's CORS allowlist (`CORS_ORIGINS=http://localhost:3110`):

```bash
lsof -ti:3110 | xargs kill -9 2>/dev/null || true
pnpm --filter @sensei/web dev
```

Runs at **http://localhost:3110**. If `apps/web/.env` set `VITE_API_BASE_URL`, the SPA now talks to the live API; otherwise it runs on its own seed data.

> **Shortcut:** `pnpm dev` at the repo root starts **both** apps at once (`turbo run dev start:dev --parallel`) — but it does **not** set `MOCK_MODE`, so the API needs a database (mode 2/3) or a `MOCK_MODE=true` in `apps/api/.env`. Prefer the explicit two-terminal flow above when you want mock mode.

### Step 8 — Verify & summarize (mandatory)

Quick end-to-end check, then a summary.

- API: `curl -s localhost:3000/ready` and open **http://localhost:3000/docs**.
- Web: open **http://localhost:3110**; log in with the demo account **`rotem@clinic.co.il` / `demo1234`** (seeded in mock mode; auto-registered against a real DB on first login).

Then give the summary (structure below).

```markdown
## Deploy summary

**Mode:** <mock | local Postgres | Supabase>
**What was done:** <deps installed, env written, Postgres started, both apps up, issues hit & fixed>

**Currently running (background tasks of this session):**
- API — http://localhost:3000 (Swagger /docs)  [logs: <how to view>]
- Web — http://localhost:3110  (login: rotem@clinic.co.il / demo1234)

**Run it yourself (outside Claude), mock mode:**
​```bash
cd /Users/ronm/git/SENSEI-MONOREPO
# terminal 1 — API
MOCK_MODE=true pnpm --filter api start:dev      # http://localhost:3000/docs
# terminal 2 — web
pnpm --filter @sensei/web dev                   # http://localhost:3110
​```
Stop: Ctrl-C in each terminal. Local Postgres: `docker compose down` (add `-v` to wipe data).
```

---

## Monitoring Rules

Both dev servers run long-lived in the background — don't launch and go silent.

- **Verify positively.** "No errors scrolled by" is not verification. Confirm `Nest application successfully started` in the API log **and** a 200 from `/health` (+ expected `/ready`). For the web, confirm Vite printed `Local: http://localhost:3110/` — if it printed a different port, kill it and restart (Step 7).
- **Never wait without a deadline.** Give every wait loop a timeout and a stall check; if the API log sits with no progress after ~30s, read the log and investigate rather than waiting.
- **Scan for known signatures** after start:
  - `EADDRINUSE` / `address already in use` — port 3000, 3110, or 5432 already held (see Common Failures).
  - `Config validation failed` (Zod) — a required/invalid env var; the message names it. Fix in `apps/api/.env`.
  - `ECONNREFUSED ...:5432` / `Unable to connect to the database` — DB not up/healthy (mode 2/3). Normal for a few seconds on boot; a problem if it persists.
  - `SELF_SIGNED_CERT_IN_CHAIN` against Supabase — `sslmode=require` (now aliased to verify-full) instead of `sslmode=no-verify`; or an un-encoded password; or port 6543 instead of 5432.
- **Fix documented failures without being asked** (apply the Common Failures fix and report it). Only stop to ask when the fix is destructive (killing a process, `docker compose down -v`).

---

## Important Rules

- **Explain before you ask.** Every time the user must act (choose a mode, confirm a kill), give the one-line reason first.
- **Config is fail-fast + Zod-validated** — `apps/api/src/config/env.schema.ts` is the single source of truth (mirrored by `.env.example`). A bad env var stops boot with a named error; read config via that schema, never invent new vars.
- **Kill port 3110 before starting the web** — Vite drifts silently to another port, which breaks the API CORS allowlist.
- **Session pooler (5432) for Supabase**, never transaction pooler (6543) — the boot migration runner needs session state.
- **Don't hand-edit the schema** — schema changes are new numbered `apps/api/db/migrations/*.sql` files, applied on boot; never edit an applied one.
- **No secrets in `VITE_*`** — Vite inlines them into the browser bundle. The web app reads only `VITE_API_BASE_URL`.

---

## Reference

### Port map

| Port | Service | Set by |
|---|---|---|
| 3000 | API | `PORT` in `apps/api/.env` (default 3000) |
| 3110 | Web (Vite) | `apps/web/vite.config.ts` (`PORT` env wins) |
| 5432 | Postgres | `compose.yaml` |

### Health endpoints (API)

| Endpoint | Meaning |
|---|---|
| `GET /` | Welcome payload |
| `GET /health` | Liveness → 200 |
| `GET /ready` | Readiness → `"mock"` in mock mode; **503** when the DB is down |

### Hot reload

- **API** — `nest start --watch`; editing any `apps/api/src/**/*.ts` recompiles in place, no restart.
- **Web** — Vite HMR; edits to `apps/web/src/**` apply instantly.
- **Dependency change** (`package.json` / lockfile) — stop the server, `pnpm install`, restart.

### The CI gate (must stay green)

```bash
pnpm turbo run lint typecheck test build   # unit + lint + typecheck + build
pnpm --filter api test:int                 # integration tests (Docker/Testcontainers)
pnpm --filter api e2e                       # if present
pnpm format                                 # prettier across the repo
```

### Teardown

```bash
# Ctrl-C each dev server, then (local-Postgres mode only):
docker compose down        # stop & remove the Postgres container (keeps the volume)
docker compose down -v     # also wipe the postgres-data volume (fresh DB next boot)
```

### Key files

| File | Purpose |
|---|---|
| `compose.yaml` | Local Postgres definition (the only container) |
| `apps/api/.env.example` | API env template — copy to `apps/api/.env` for DB/Supabase/keys |
| `apps/api/src/config/env.schema.ts` | Zod schema — single source of truth for API env vars |
| `apps/api/db/migrations/*.sql` | Ordered schema migrations, applied on boot, tracked in `_migrations` |
| `apps/web/.env.example` | Web env template — only `VITE_API_BASE_URL` |
| `apps/web/vite.config.ts` | Web dev/preview port (3110) |
| `package.json` (root) | `pnpm dev` (both apps), CI gate scripts |

### Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE :3000` | API already running / port held | `lsof -nP -i :3000`, ask user, then kill the holder |
| Web starts on 3111+ instead of 3110 | Vite fell back — 3110 was busy | `lsof -ti:3110 \| xargs kill -9`, restart web |
| SPA calls fail with CORS error | Web on a non-3110 port, or `VITE_API_BASE_URL` unset/wrong | Restart web on 3110; set `apps/web/.env` → `VITE_API_BASE_URL=http://localhost:3000` |
| `Config validation failed` at API boot | Missing/invalid env var (Zod) | Read the named var; fix in `apps/api/.env` (see `.env.example`) |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres not up/healthy (mode 2) | `docker compose up -d postgres`, wait for `(healthy)` in `docker compose ps` |
| `/ready` returns 503 | DB down in a DB-backed mode | Same as above; or switch to `MOCK_MODE=true` |
| `SELF_SIGNED_CERT_IN_CHAIN` (Supabase) | `sslmode=require` is treated as verify-full and rejects the self-signed chain | Use `?sslmode=no-verify`; ensure the password is URL-encoded; session pooler **5432**, not 6543 |
| AI/audio flows do nothing | `ANTHROPIC_API_KEY` / `ELEVENLABS_API_KEY` unset | Set them in `apps/api/.env`, or use `MOCK_MODE=true` to fake them |
| `Cannot connect to the Docker daemon` | Docker not running (only matters for mode 2 / `test:int`) | Start Docker Desktop, or use mock mode |
