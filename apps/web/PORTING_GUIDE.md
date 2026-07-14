# Sensei React Port — Porting Guide (for all porting agents)

> **HISTORICAL — kept for provenance.** This is the build-time contract used to port the
> original HTML prototype into this React app. It references a temporary extraction path that
> no longer exists, and the canonical modules/conventions it describes now live in
> [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md) (the current sources
> of truth). Read those for present-day development.

## Source of truth

The prototype (authoritative design + behavior spec):

```
Sensei demo.dc.html   — the exported high-fidelity prototype (kept outside this repo)
```

- Template (DC markup): lines **218–2514**. Logic class (`class Component extends DCLogic`): lines **2516–5120**.
- Template block line map (each `<sc-if value="{{ isX }}">` wraps one screen):
  auth 256–381 · shell(sidebar+appbar) 382–507 · dashboard 508–611 · patients 612–650 ·
  patient 651–815 · sessions 816–842 · upload 843–943 · transcript 944–983 ·
  summary 984–1076 · timeline 1077–1112 · report 1113–1172 · letter 1173–1199 ·
  dedup 1200–1244 · analytics 1245–1306 · tasks 1307–1353 · notifications 1354–1429 ·
  search 1430–1485 · documents 1486–1526 · help 1527–1567 · calendar 1568–1684 ·
  settings 1685–2039 · messages 2040–2086 · resources 2087–2114 · team 2115–2140 ·
  supervision 2141–2185 · reports 2186–2213 · cpd 2214–2244 · outcomes 2245–2280 ·
  overlays (shortcuts, ⌘K palette, AI assistant, dialogs, snackbar, offline) 2281–2514.
- View-model code: grep the file for your screen's flag (`v.isMessages`, `S.route === 'calendar'`, etc.)
  inside `renderVals()` (starts line 3240) and port the relevant derivations + handlers.
- Read your slice with `sed -n 'START,ENDp'` — do NOT read the whole file at once.

## App architecture (already in place — do not restructure)

- `src/store/AppStore.tsx` — global store. `useApp()` returns:
  `{ S, set, navigate, toast, copyToClipboard, applyThemePref, setA11y, resetA11y, pager, logout, login }`
  - `S` is the full state object (same keys as the prototype's `this.state` — see `src/data/seed.ts`).
  - `set(patchOrFn)` = the prototype's `this.setState(...)`.
  - `navigate(route, patch?)`, `toast(msg, type?, action?)` = same semantics as the prototype.
  - `pager(items, pageKey, sizeKey)` returns `{ slice, view }`; render `view` with
    `src/components/shared/Pager.tsx` (`<Pager p={view} />`).
- Utils in `src/utils/index.ts`: `riskMeta`, `avatarColors`, `validateFile`, `getPatient(S.patients, id)`,
  `hg(template, gender)` (gendered Hebrew via window.HG — replaces `window.HG.fill`).
- Nav config in `src/nav/navConfig.ts` (`navConfig()`, `ROUTE_TITLES`).
- Pages live at `src/pages/<Name>Page.tsx` (stubs exist — replace the stub in place, keep the
  default export and file name). Auth: `src/pages/auth/AuthScreens.tsx`. Shell:
  `src/components/layout/AppShell.tsx`.

## Conversion rules (fidelity is the point — port, don't redesign)

1. `sc-if value="{{ x }}"` → `{x && (…)}` · `sc-for list="{{ xs }}" as="y"` → `{xs.map((y) => …)}` with a stable `key`.
2. `{{ expr }}` → `{expr}`; `onClick="{{ fn }}"` → `onClick={fn}` where `fn` comes from the ported view-model code.
3. Inline `style="a:b;c:d"` → JSX `style={{ … }}` **preserving every declaration and token var exactly**.
4. `style-hover="…"` / `style-focus="…"` → a CSS class in a co-located stylesheet you create
   (`src/pages/<name>.css`, imported by your page only; prefix every class with your screen name,
   e.g. `.msg-thread-row:hover{…}`). Never edit `global.css` or `tokens.css`.
5. Keep every `aria-*`, `role`, `dir`, `lang`, `tabindex` attribute. Keep `className` values that
   already exist in the source (`rx-*`, `app-sidebar`, `appbar*`, `nav-toggle`, `skip-link`, …) —
   the responsive CSS keys off them.
6. Colors: **zero hardcoded hex** — only `var(--token)` (exception: data-driven avatar hex from state).
7. Hebrew only, plural voice (לשון רבים), no emoji, technical strings (phone/email/date/time) get `dir="ltr"`.
8. Images live at `/assets/<name>.png` (e.g. `<img src="/assets/sensei-mark.png" …>`).
9. TypeScript is non-strict; `any` is acceptable where the prototype was untyped. The file must
   compile under `npx tsc --noEmit` from the repo root.
10. Local ephemeral UI state (hover index, local drafts) may use `useState`; anything the prototype
    kept in `this.state` stays in the store via `set(...)`.
11. The prototype's `this.renderVals().someAction()` calls from keyboard handlers etc. are already
    wired in the store where global; screen-local actions live in your page component.
12. `outcomes` embeds a shared DataGrid child (`dc-import`). Port it as a standard-treatment data
    table (search input, sortable-looking header, rows from `outcomesGridRows` in renderVals, empty
    state) — full grid engine is out of scope; match the visual treatment of the other tables.

## Definition of done for a ported screen

- Pixel-faithful markup vs the template block (same structure, spacing, tokens, copy).
- All interactions in the template block work against the store (search, filters, CRUD, dialogs
  open via `set({ dialog: … })`, toasts).
- Loading skeleton state honored where the template has one (`S.loading`).
- Empty / no-results states ported.
- `npx tsc --noEmit` passes; the dev server renders the screen without console errors.
