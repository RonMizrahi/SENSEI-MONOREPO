# Documentation Index — Sensei Frontend

Every documentation topic has **one canonical home**; anything not listed as its
own file lives inside one of these. If you add a doc, register it here — this
index is what prevents duplication and drift.

| Doc | Canonical home |
|---|---|
| README (run · scope · MVP coverage · deployment · known debt) | [README.md](../README.md) |
| Contributor orientation (AI/human) | [CLAUDE.md](../CLAUDE.md) |
| Product: PRD · personas · IA · journeys · flows · screens | [docs/PRODUCT.md](PRODUCT.md) |
| Design system: tokens · components · interaction states · responsive · RTL · motion | [docs/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| UX writing · voice & tone · terminology · microcopy · a11y writing | [CONTENT_GUIDE.md](../CONTENT_GUIDE.md) |
| Frontend architecture: layers · single-source map · state · routing · API integration seam | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Decision records (ADRs, incl. shipped answers to spec open questions) | [docs/ADR.md](ADR.md) |
| Testing strategy · QA · coverage · mocking · TDD | [TESTING.md](../TESTING.md) |
| Enforcement rules · setup · contribution guide | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Changelog / release notes (newest first; version-guarded) | [CHANGELOG.md](../CHANGELOG.md) |
| Historical: prototype→React porting contract | [PORTING_GUIDE.md](../PORTING_GUIDE.md) |
| Hackathon presenter demo script (5-minute walkthrough) | [docs/DEMO.md](DEMO.md) |
| Backend integration: senseiapi contract map · env switch · gap report | [docs/INTEGRATION.md](INTEGRATION.md) |

## Topic → home quick map

- **Functional spec / screen specs** → PRODUCT.md §5 + the route map in code
  (`src/nav/navConfig.ts`, `src/pages/`); acceptance criteria of the hackathon
  spec are implemented and guarded by tests.
- **Design tokens** → `src/styles/tokens.css` (code is canonical) + DESIGN_SYSTEM.md §1.
- **Component library & usage** → DESIGN_SYSTEM.md §5 + ARCHITECTURE.md single-source map.
- **Branding** → DESIGN_SYSTEM.md §1 (brand tokens) + CONTENT_GUIDE.md §1 (voice).
- **Accessibility guidelines** → DESIGN_SYSTEM.md §4/§6 + CONTENT_GUIDE.md §6; verified by the a11y test suites.
- **Responsive & RTL guidelines** → DESIGN_SYSTEM.md §2–3; RTL rules also in CLAUDE.md (binding conventions).
- **Routing / state / styling & theming** → ARCHITECTURE.md; theming tokens in DESIGN_SYSTEM.md §1.
- **API integration & data models** → docs/INTEGRATION.md (contract) + ARCHITECTURE.md § Backend integration + `src/services/`.
- **AI features** → PRODUCT.md (journeys J1–J2) + ARCHITECTURE.md (AI seam); all AI output is seed-driven until a backend is wired (truthfulness rule: CONTENT_GUIDE §5).
- **Configuration & environment** → README § Running + ARCHITECTURE.md (`VITE_API_BASE_URL` only; no secrets in `VITE_*`).
- **Performance** → README § Deployment (immutable-asset caching, code splitting via `React.lazy`, no source maps); budgets guarded by build output review.
- **Build & deployment** → README § Deployment (+ `vercel.json`, `public/_headers`).
- **Troubleshooting / maintenance** → CONTRIBUTING.md (enforcement table: verify command, failure condition, rollback per rule).
- **Known limitations / technical debt / roadmap** → README § Known debt (single tracked list) + ARCHITECTURE.md § roadmap notes.
- **Release notes** → CHANGELOG.md (per-version, user-visible changes; CI-guarded against version drift).

## Explicitly not applicable (client-only frontend)

- **CMS / visual editor** — none exists in this product.
- **Frontend analytics** — none by design (privacy-first demo; no trackers, and
  CSP `connect-src 'self'` would block them). Revisit only with a real backend.
- Backend/database/infra/DevOps docs — out of scope per repo policy.
