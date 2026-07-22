# Sensei — Therapist Management App (Frontend)

**Version:** 1.59.1 · **Stack:** Vite · React 18 · TypeScript · Hebrew RTL
**Live demo:** https://sensei-hackathon-app.vercel.app · **Repo:** [avitalg/SENSEI](https://github.com/avitalg/SENSEI) (branch `chore/maintenance-sync`)

Sensei is a Hebrew-only, RTL, AI-assisted practice-management app for licensed therapists —
the production React frontend built from the *"Sensei design 2026"* high-fidelity prototype
and the hackathon PRD/feature-map. It covers the full MVP: onboarding patients, uploading
session recordings, viewing AI transcripts and summaries, risk flags, treatment goals,
timelines, and prep reports — across **23 routes**, **5 auth states**, and **light/dark themes**.

> **Scope:** this is a **client-only** build. It runs on seeded demo data + `localStorage`;
> there is no backend yet. A canonical, typed API layer (`src/services/`) is in place but
> **dormant** until `VITE_API_BASE_URL` is set — see [ARCHITECTURE.md](ARCHITECTURE.md) §
> "Backend integration". It is a production-ready *demo/design reference*, not a live clinical
> system (which would require the PRD §10 backend: transcription, LLM analysis, RBAC, storage).

## Running

```bash
npm install
npm run dev            # http://localhost:3110
npm run lint           # eslint (flat config, --max-warnings=0)
npm run typecheck      # tsc --noEmit
npm test               # vitest suite (unit · route smoke · a11y · canonical guards)
npm run test:coverage  # + coverage thresholds (logic + services layer ≥75%; currently ~81%)
npm run dup            # jscpd duplication guard (fails > 5%; currently ~3%)
npm run build          # typecheck + production bundle (no source maps)
npm run preview        # serve the production build
npm run check          # one-shot local gate: lint + tests + build (typecheck runs inside build)
npm run package        # git archive → sensei-app-2026.zip (tracked source only; respects export-ignore)
```

Run `npm run check` before pushing — it mirrors the core CI gate in a single command (CI additionally
runs coverage, duplication, and a production-dependency audit).

CI (`.github/workflows/ci.yml`) runs lint → typecheck → tests+coverage → duplication → build →
prod-dependency audit on every push/PR. A `concurrency` group cancels superseded runs on a
PR/branch (never on `main`), so the newest run is always the authoritative status.

**Monitoring:** watch the repository's **Actions** tab, or the checks on each PR. The repo lives at
[avitalg/SENSEI](https://github.com/avitalg/SENSEI); the CI status badge:

```md
![CI](https://github.com/avitalg/SENSEI/actions/workflows/ci.yml/badge.svg)
```

Every automated guard's threshold and **where to change it** is documented in the enforcement table in
**[CONTRIBUTING.md](CONTRIBUTING.md)** (e.g. coverage in `vite.config.ts`, duplication in `.jscpd.json`).

## MVP requirements coverage (PRD §6)

| # | Requirement | Screen(s) |
|---|---|---|
| 6.1 | Therapist registration / login | `pages/auth/AuthScreens` + `services/mockAuth` — mock credentials, registration (strength meter, duplicates, terms), simulated Google, forgot→reset→done, Remember Me |
| 6.2 | Patient management (create/edit/search) | `PatientsPage`, `PatientPage` |
| 6.3 | Session creation + attach recording | schedule dialog (`layout/Dialogs`), `UploadPage` |
| 6.4 | Upload mp3/wav/m4a | `UploadPage` (`validateFile`) |
| 6.5 | Transcription + speaker separation | `TranscriptPage` (two-sided therapist/patient) |
| 6.6 | Summary / Insights / Risk Flags (not a diagnosis) | `SummaryPage` |
| 6.7 | Timeline (patient history) | `PatientPage` timeline + `PatientMeetingHistoryPage` |
| 6.8 | Prep report (what changed / open topics / goals / follow-ups) | `ReportPage` |
| §7 | Full data export + deletion (frontend views) | `settings/ProfileTab` ("הנתונים שלך"), delete dialogs |

Out-of-MVP patient-facing features (§8) are intentionally not built. Transcription/LLM/RBAC/storage
are backend scope (PRD §10) and don't exist here; the frontend displays them via seed data.

## Architecture

```
src/
  styles/tokens.css       ← canonical design tokens (light :root + [data-theme="dark"], a11y, responsive)
  styles/global.css       ← Heebo @font-face + shared utilities (skeleton, overflow-x clip)
  data/                   ← seed.ts (demo state) · catalogs.ts · sessions.ts · shortcuts.ts (canonical data)
  types/                  ← domain model types (the API contract)
  store/AppStore.tsx      ← global store: state patches, localStorage persistence, theme + a11y, shortcuts
  nav/navConfig.ts        ← navigation single source of truth + ROUTE_TITLES
  nav/urlHash.ts          ← URL-hash ↔ route mapping (deep links, back button, testability)
  hooks/useFocusTrap.ts   ← modal focus trap + restore
  services/               ← canonical typed API client + ApiService<T> CRUD (dormant; see ARCHITECTURE.md)
  utils/                  ← search · format · dedup · styles · themeIcons · share · riskMeta/avatarColors/hg…
  components/layout/      ← AppShell: sidebar, appbar, ⌘K palette, AI assistant, notifications, dialogs, snackbar
  components/shared/      ← Pager · ErrorBoundary · ShareMenu · PrivacyNotice · Highlight · PageFallback
  pages/                  ← one lazy-loaded file per route (23) + auth/AuthScreens
public/hebrew-grammar.js  ← gendered-Hebrew microcopy layer (window.HG)
```

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the layer rules and the full single-source-of-truth map.

- **Routing** — a state-driven `route` key (no router lib), route-level code splitting via `React.lazy`,
  wrapped in an error boundary that recovers on navigation. A hash layer (`nav/urlHash.ts`) mirrors the
  route into `location.hash` (`#/analytics`, `#/patient/p3`) so every app screen is deep-linkable,
  bookmarkable, refresh-safe, and Back-button-navigable; auth/dialogs/overlays stay state-driven, and a
  URL sets the route only (never the view), so it can't bypass sign-in.
- **Persistence** — `PERSIST_KEYS` debounced into `localStorage` (`sensei_session_react_v1`).
- **Themes** — light/dark with `system` tracking, applied as `data-theme` on `<html>`.
- **Accessibility (WCAG 2.2 AA)** — skip link, landmarks, focus-visible, reduced-motion, user a11y
  prefs (`data-a11y-*`), keyboard activation shim, modal focus trap. Verified by axe across all
  routes + a token-based contrast audit (both themes).
- **RTL** — 100% logical CSS properties (`insetInline*`, `marginInline*`, `textAlign start/end`),
  enforced by a guard so no physical direction property can re-enter.

## Conventions (binding)

- Hebrew only, RTL throughout; plural voice (לשון רבים); no emoji in UI.
- Colors come from `var(--token)`; a frozen baseline of pre-existing hardcoded hex is
  ratchet-guarded (non-increasing — prefer tokens).
- Technical strings (phone, email, date, license, time) are `dir="ltr"`.
- All shared logic/data/styles have one canonical home (see ARCHITECTURE.md); duplication is
  CI-guarded. All backend access goes through `src/services/`.

## Testing & enforcement

The vitest suite covers: unit (`utils`, `searchUtils`), route smoke (all 23), a11y (axe, all routes +
overlays; keyboard combobox for search + palette), contrast, focus-trap, error-boundary, API client,
and the **canonical / architecture / RTL / design-token / copy-integrity / heading-order / emoji /
version-consistency guards** (`tests/canonical.test.ts`). Each enforcement rule — with owner, verify
command, failure condition, rollback, and accepted exceptions — is documented in
**[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Deployment

Ships a CSP + security headers via `vercel.json` (Vercel) and `public/_headers` (Netlify):
`script-src 'self'`, `style-src 'self' 'unsafe-inline'` (React inline styles), `connect-src 'self'`,
`frame-ancestors 'none'`, plus HSTS / nosniff / Referrer-Policy / Permissions-Policy. Verify the CSP
on first deploy (headers are a hosting-layer concern).

**Cache-control (cache-safety):** content-hashed build assets under `/assets/*` are served
`immutable, max-age=1y`; HTML (the `index.html` entry + all SPA routes) is `max-age=0,
must-revalidate` so a returning user always fetches fresh HTML that references the current asset
hashes — no stale UI, no dead-chunk mismatch after a deploy. There is no Service Worker, so no SW
update lifecycle to manage. The split is guarded in `tests/canonical.test.ts`.

**Live deployment:** production is on **Vercel** (project `sensei-hackathon-app`,
https://sensei-hackathon-app.vercel.app). It is a **manual CLI deployment** — the repo is *not*
wired to Vercel for automatic deploys, so a push does **not** redeploy. To ship a new version, run
`npx vercel --prod` from the repo root (the local `.vercel/` link is gitignored). All headers above
are verified live on each deploy. For true push-to-deploy, connect the GitHub repo to a Vercel
project in the dashboard and set `chore/maintenance-sync` (or `main`) as the production branch.

## Known debt (deliberate, tracked)

- The dormant API auth layer (`src/services/apiAuth.ts`) keeps its bearer token in
  web storage. Acceptable while dormant (no backend, CSP `script-src 'self'`, no
  XSS sinks in the codebase), but when a real backend is wired, prefer httpOnly
  cookies (or accept and document the web-storage tradeoff explicitly).
- No backend yet — the `src/services/` layer is dormant until `VITE_API_BASE_URL` is set and the
  store is wired to it screen-by-screen (see ARCHITECTURE.md § "Wiring a backend").
- No Storybook / visual-regression yet.

## Docs

Full topic → document map: **[docs/INDEX.md](docs/INDEX.md)** (one canonical home per topic — register new docs there).

- **[docs/PRODUCT.md](docs/PRODUCT.md)** — PRD, personas, information architecture, user journeys, screen inventory.
- **[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)** — design tokens, components, interaction states, responsive/RTL/motion rules.
- **[docs/ADR.md](docs/ADR.md)** — architecture & design decision records (incl. shipped answers to the screen-spec's open questions).
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — layers, single-source-of-truth map, backend integration plan.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — setup, enforcement rules, accepted exceptions.
- **[TESTING.md](TESTING.md)** — test stack, how to run, suite map, mocking strategy, TDD workflow, coverage expectations, limitations.
- **[CONTENT_GUIDE.md](CONTENT_GUIDE.md)** — voice, terminology dictionary, microcopy patterns, Hebrew/RTL + content governance.
- **[CHANGELOG.md](CHANGELOG.md)** — version history (newest first).
- `PORTING_GUIDE.md` — historical: the contract used to port the prototype into React.
