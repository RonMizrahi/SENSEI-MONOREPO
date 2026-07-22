# Local deploy — full stack (frontend + backend)

Run the Sensei demo locally: this **Sensei** frontend (Vite/React) and, optionally, the
**senseiAPI** backend (FastAPI + Postgres, repo
[`avitalg/senseiAPI`](https://github.com/avitalg/senseiAPI)) for the live "שאל את סנסיי" assistant.

The frontend runs standalone in **demo mode** (seed data + `localStorage`, no backend). Wire
the backend only to exercise the live services layer + the streaming AI assistant.

## Prerequisites
- **Node ≥ 18** (frontend). For the backend: **Docker** + **Python 3.11**.

## 1 · Frontend (this repo)

```bash
npm install

# Demo mode — no backend, fastest:
npm run dev                             # http://localhost:3110
```

Login is mock auth: **`rotem@clinic.co.il` / `demo1234`**. With no `VITE_API_BASE_URL` set,
nothing calls a backend.

**API-connected mode** — point the app at a running senseiAPI. Vite reads env from a
gitignored `.env.local` at startup (no secrets — only `VITE_`-prefixed, client-safe values):

```bash
echo 'VITE_API_BASE_URL=http://localhost:8000' > .env.local
npm run dev                             # http://localhost:3110, now talking to :8000
```

> Vite inlines env at **startup**, so restart the dev server after editing `.env.local`.

## 2 · Backend — optional, for the live assistant

In the sibling `senseiAPI` checkout — see its `LOCAL_DEPLOY.md`. In short:

```bash
docker compose up -d                    # Postgres (+ canonical demo seed on first init)
cp .env.example .env                    # set OPENAI_API_KEY for live answers
.venv/bin/uvicorn main:app --port 8000  # API on :8000
```

The seed provides the canonical roster (הארי / סימבה / פורסט) with sessions + summaries; in
dev, auth resolves to a fixed user that owns that data, so no login/token is needed from the
frontend.

## 3 · Verify the assistant end-to-end
With both running, open **"שאל את סנסיי"** and click **"סכמו את הפגישה האחרונה עם סימבה"** —
the panel streams the answer via the backend's tool chain (patients → meetings → summary),
with numeric dates. In demo mode the same chips return the canned offline answers.

## Ports
| Service | URL |
|---|---|
| Frontend (dev / API-connected) | http://localhost:3110 |
| Backend API | http://localhost:8000 |
| Postgres | localhost:5432 |
