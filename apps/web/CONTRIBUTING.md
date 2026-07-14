# Contributing — Sensei

## Setup & local checks

```bash
npm install
npm run dev            # http://localhost:3110
npm run lint           # eslint (flat config, --max-warnings=0)
npm run typecheck      # tsc --noEmit
npm test               # vitest (unit, route, security, a11y, contrast, canonical…)
npm run test:coverage  # + coverage thresholds
npm run dup            # jscpd duplication guard (threshold 5%)
npm run build          # typecheck + production bundle
```

Before opening a PR, run `npm run lint && npm run typecheck && npm test && npm run build`.
CI (`.github/workflows/ci.yml`) runs the same on every push/PR and blocks on any failure.

## Testing & TDD workflow

**Test-first for new behavior.** For a new feature, bug fix, or behavioral change, follow
Red → Green → Refactor:

1. **Red** — write a failing test that describes the intended behavior; run it and confirm it
   fails *for the right reason* (asserting real output, not a typo).
2. **Green** — write the minimal code to pass it.
3. **Refactor** — clean up with all tests green; re-run the full suite for regressions.

Every bug fix ships with a test that fails before the fix and passes after — this repo's history is
full of them (see the guards in `tests/canonical.test.ts` and the a11y keyboard tests).

**Test layout** (`tests/`, colocated by concern, one file per area):

| Layer | Files | Covers |
|---|---|---|
| Unit / logic | `utils.test.ts`, `searchUtils.test.ts`, `pager.test.tsx`, `apiClient.test.ts`, `navConfig.test.ts`, `urlHash.test.ts` | pure functions, the store's `pager` view-model + `resolveTheme`, the API client, nav config, URL-hash routing |
| Component / a11y | `a11y.test.tsx`, `focusTrap.test.tsx`, `errorBoundary.test.tsx`, `contrast.test.ts` | axe on all routes + overlays, keyboard combobox (search/palette), focus trap, boundary recovery, contrast |
| Route smoke | `routes.test.tsx` | every one of the 23 routes renders without throwing |
| Enforcement guards | `canonical.test.ts` | single-source-of-truth, architecture, RTL, tokens, copy-integrity, heading-order, emoji, version, docs |

**Conventions:** deterministic and isolated (no `sleep`/random/order-dependence; `afterEach` cleans
up DOM + `localStorage`); assert behavior, not implementation; mock only true externals (the API
layer is dormant, so most logic is tested for real). Coverage is measured on the logic layer
(`utils/store/hooks/nav/data`, threshold ≥70%; currently ~94% lines / ~84% branches) — presentational
pages are covered by the route-smoke + a11y suites, not line-counted. Coverage **quality** over a
percentage: prefer one test that pins a real edge case to ten that restate the happy path.

To add a test: pick the file for its layer above (or add `tests/<area>.test.tsx`), name the `it(...)`
after the behavior ("clamps an out-of-range page to the last page"), and keep it runnable in
isolation (`npx vitest run tests/<file> -t "<name>"`).

## Single source of truth

Every shared concept has exactly one home — see [ARCHITECTURE.md](ARCHITECTURE.md). **Do not
re-declare a shared helper, constant, catalog, or style in a page**; import it from its canonical
module. New shared logic goes in `utils/` (pure), `data/` (seed/catalog), or the store (state).

## Enforcement rules (Phase 9.5)

Each rule is deterministic, low-noise, and passes on the current tree. To relax one, edit its
owner file (never add broad ignores).

| # | Rule | Owner | Verify | Fails when | Rollback |
|---|---|---|---|---|---|
| Single source of truth | each canonical symbol defined once, in its stated home | `tests/canonical.test.ts` | `npm test` | a symbol is re-declared or moved | edit the `CANONICAL` map / remove the dup |
| Architecture | leaf modules (`utils/data/hooks/nav`) don't import UI/state; no page→page imports | `tests/canonical.test.ts` | `npm test` | a forbidden cross-layer import is added | move the code to the correct layer |
| Documentation | required docs exist (`README`, `CHANGELOG`, `CONTRIBUTING`, `ARCHITECTURE`, `.env.example`) | `tests/canonical.test.ts` | `npm test` | a required doc is deleted | restore the doc |
| Design-token ratchet | hardcoded hex in `.tsx` ≤ baseline (66) | `tests/canonical.test.ts` | `npm test` | new hardcoded hex is added | use `var(--token)`; lower the baseline when reducing debt |
| Code duplication | copy-paste ≤ 5% (min-tokens 80) | `.jscpd.json` | `npm run dup` | duplication exceeds 5% | extract the block to a shared module |
| Secrets / unsafe render / storage | no secrets, no `dangerouslySetInnerHTML`/`eval`, no credentials persisted, `window.open` uses noopener | `tests/security.test.ts` | `npm test` | any of the above is introduced | remove the offending pattern |
| Coverage | logic-layer coverage ≥ 70% | `vite.config.ts` `test.coverage` | `npm run test:coverage` | coverage drops below threshold | add tests |
| Accessibility | axe clean on all 23 routes + overlays; AA contrast both themes; modal focus trap | `tests/a11y.test.tsx`, `tests/contrast.test.ts`, `tests/focusTrap.test.tsx` | `npm test` | a WCAG regression is introduced | fix the a11y defect |
| Version consistency | `package.json` version === newest `CHANGELOG` entry === `README` version badge | `tests/canonical.test.ts` | `npm test` | a release bump lands in one file but not the others | sync all three to `package.json` |
| Copy integrity | action-confirmation copy (merge/delete/session dialogs + toasts, summary-approval status) promises no archival, N-day retention, or activity-log logging the code does not perform | `tests/canonical.test.ts` | `npm test` | such copy re-adds an "archived / restorable in N days / logged to the activity log" claim | reword to match behavior (immediate undo only) — or implement the store, then update the guard |
| Heading order | no view skips a heading level (any `.tsx` using `<h3>` also uses `<h2>`; no `<h4>`–`<h6>`) | `tests/canonical.test.ts` | `npm test` | a file jumps `<h1>`→`<h3>` (common on empty-state headings) | use the next level down; headings carry inline font-size so the tag is semantic-only |
| No emoji in UI | no `.ts`/`.tsx` source contains an emoji (U+1F000–1FAFF) — see [CONTENT_GUIDE.md](CONTENT_GUIDE.md) | `tests/canonical.test.ts` | `npm test` | an emoji is added to a string/label/seed message | remove it — use plain text or a Design-System icon (functional glyphs ↑↓↺→ are fine) |

### Accepted exceptions (explicit, minimal, documented)

- **Hardcoded-hex baseline (66):** the data-driven avatar palette + on-accent icon fills that pass
  the 3:1 graphics threshold + the onboarding-banner gradient. Frozen (non-increasing); reduce over
  time by switching to `var(--token)`.
- **Capability/policy descriptions vs. action confirmations (copy integrity):** general product
  descriptions that represent the demo's audit-log feature (`HelpPage` privacy FAQ, `DocumentsPage`
  signature note — alongside the equally-represented RBAC/PII claims) are out of the copy-integrity
  guard's scope. Only per-action confirmations (dialogs/toasts/status) must be literally true in
  this build.
- **`buildSessions` / `nMeta` / `routeFor` / `resCatMeta` / `tagMeta`:** intentionally divergent
  per-screen implementations (see ARCHITECTURE.md), not redundant duplicates — excluded from the
  single-source guard by design.
- **`import.meta.env.VITE_API_BASE_URL`:** the one allowed env read — a client-safe public
  backend base URL (not a secret) consumed by the dormant API client. Any other env read fails
  the security guard. See [ARCHITECTURE.md](ARCHITECTURE.md) § "Backend integration".

## Regression protection

Every fixed bug or resolved duplication gets a test so it can't silently return. Examples:
`tests/canonical.test.ts` (dedup/drift), `tests/searchUtils.test.ts` + `tests/focusTrap.test.tsx`
(consolidated utils/hooks), `tests/errorBoundary.test.tsx` (page-crash recovery),
`tests/contrast.test.ts` (a real dark-mode contrast bug).
