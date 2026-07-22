# Design System — Sensei

The design source of truth. **Code is canonical**: tokens live in
`src/styles/tokens.css`, shared utilities in `src/styles/global.css`; this doc
explains the system and its rules so changes stay coherent. Copy/voice rules:
[CONTENT_GUIDE.md](../CONTENT_GUIDE.md). Doc map: [INDEX.md](INDEX.md).

## 1. Design tokens (`src/styles/tokens.css`)

One `:root` block (light) + one `[data-theme="dark"]` override block — every
color in the app resolves from these ~40 variables. **Hardcoded hex is
ratchet-guarded in CI** (frozen baseline, non-increasing).

| Group | Tokens | Use |
|---|---|---|
| Brand | `--primary(-dark/-darker/-light/-tint/-surface/-border)`, `--accent-grad-*`, `--on-accent` | Actions, active states, highlights |
| Semantic | `--info*`, `--success*`, `--warning*`, `--error*` | Feedback states (note: the palette is deliberately blue-family — calm, non-alarming for a clinical tool) |
| Surfaces | `--bg`, `--paper`, `--surface(-2/-3)`, `--skeleton-*` | Page, cards, wells, loading shimmer |
| Text | `--text`, `--text-2`, `--text-secondary`, `--text-muted`, `--text-disabled` | 5-step hierarchy; all AA-checked in both themes |
| Lines | `--divider`, `--line`, `--border-input`, `--selection`, `--scroll` | Borders and chrome |
| Session categories | `--cat-{weekly,followup,intake,video,couples}-{bg,bar,text}` | Calendar event coding (single source: `src/data/sessionCategories.ts`) |
| Special | `--now-line`, `--ink*` | Calendar "now" indicator, dark ink panels |

**Theming.** `data-theme` on `<html>`; `system` preference tracked live. Never
read a raw color — always `var(--token)`, so both themes stay correct.

**Non-token scales (conventions, enforced by review not CI):**
- Radius: 6–7px small controls · 9–10px inputs/cards · 12px feature cards ·
  14px large structural containers (calendar frame, side panels).
- Card shadow: `CARD_SHADOW` (`src/utils/styles.ts`) — one elevation for cards.
- Type: Heebo; page h1 27/900 (letter-spacing −0.6px — one size on every screen,
  guarded by `tests/typographyConsistency.test.tsx`), card h2 13–16/700, body
  13–14.5, meta 11–12.5.

## 2. Layout & responsiveness

- Desktop shell (`components/layout/AppShell`): sidebar + routed page. The global
  top bar was removed app-wide to maximize usable space; its actions live in the
  sidebar — the primary "Upload recording" CTA (top), demo-mode indicator, and
  theme toggle + account + logout (footer). The only content-column chrome is the
  off-canvas drawer toggle (`.nav-toggle`), shown ≤860px where the sidebar is a drawer.
- Sidebar: sized by `.app-sidebar` with `100dvh` (+`100vh` fallback) and a
  safe-area-inset footer — fixed header, scrollable nav body, pinned utility
  group (הגדרות last) + profile footer; only the nav body scrolls.

- Mobile (<768px, `useIsMobile`): dedicated touch shell (`components/mobile/`).
- Fluid layouts (flex/grid + minmax); wide content scrolls inside its own
  container. Breakpoints: 768px (shell switch), 1024px (calendar side panel
  drops below the grid).

## 3. RTL (binding, CI-guarded)

Hebrew-only, `dir="rtl"` at the root. **Logical CSS properties only**
(`marginInline*`, `insetInline*`, `paddingInline*`, `textAlign:'start'/'end'`);
physical direction properties are banned by a guard. Technical strings (phone,
email, date, time, license) render `dir="ltr"` inline.

## 4. Interaction states

Defined globally in `tokens.css`:
- **Hover/active/selected** — token-based transitions (~140–180ms) on background,
  border, color, shadow; buttons get a subtle transform.
- **Focus** — `:focus-visible` 2px `--primary` outline + offset (never removed);
  a high-visibility variant under the user a11y preference (`data-a11y-*`).
- **Keyboard** — global activation shim: Enter/Space activates any
  `role="button"`; `cursor:pointer` elements are auto-promoted to focusable
  buttons (with nested-interactive protection). Modals: focus trap + restore +
  Escape. ⌘K palette; shortcuts in `src/data/shortcuts.ts`.
- **Disabled** — `--text-disabled` + `aria-disabled`; never removed from the DOM.
- **Loading** — skeleton shimmer (`--skeleton-*`) or thin progress bar; buttons
  keep their box size while loading.
- **Touch targets** — 44px minimum floor on touch surfaces: visible sizes where
  practical, else the shared `.tap44` invisible hit-expansion overlay
  (global.css; same technique as the agenda "+"). A static guard forbids
  `<button>` styles that set a directional border without a `border` reset
  (UA borders render white in dark mode).
- **Reduced motion** — `prefers-reduced-motion` collapses transitions/animations.
- **Drag & drop** — calendar events; drop targets tint with `--primary-tint`;
  the dragged item dims. Keyboard path stays available (edit dialog).

## 5. Component inventory (canonical homes)

| Component | Home | Notes |
|---|---|---|
| Cards | per-page + `CARD_SHADOW` | radius/shadow conventions above |
| Buttons | `shell-*` / `pd-*` / `calh-*` classes + inline token styles | primary = filled `--primary`; secondary = 1px `--border-input` outline |
| Fields (SSOT) | `.shell-input` / `.app-select` / `.app-search` + `.auth-input` / `.set-input` / `.trs-search` / `.mob-sheet-textarea`, plus a zero-specificity `:where(input…,textarea,select)` **blue floor** in global.css | Unified **blue** control surface: `--primary-surface` fill + `--primary-border` edge, 44px, 10px radius, 14.5px, `--text` value; error → `--error` border + inline message + focus-to-field. The `:where()` floor means any NEW text-like field is blue by default without per-field styling (non-text controls — checkbox/radio/file/range/color/buttons — are excluded; the command palette input opts out with `background:transparent`). Same design across inputs, textareas, selects, date/time pickers, and search fields in both themes |
| Dialogs | `components/layout/Dialogs.tsx` | one host; `role="dialog"` + `aria-modal` + trap |
| Checkbox | `components/shared/Checkbox` | Blue `.ds-checkbox` SSOT (global.css): native checkbox restyled with `--primary-border`/`--primary-surface` unchecked and `--primary` fill when checked/indeterminate, tokened focus ring + disabled; identical in both themes. Used for remember-me, signup terms, and the New-Patient "schedule first session" toggle |
| Confirm dialog | `ConfirmDialog` (in `Dialogs.tsx`) | SSOT for every destructive confirmation (archive/delete/wipe/account): icon-circle + title + message + danger/cancel; per-dialog icon, copy, label, handler, optional extra as props |
| Sheets (mobile) | `components/mobile/*` | bottom sheets, Escape + trap |
| Toast/snackbar | store `toast()` | success/info; offers undo where reversible |
| Privacy notice | `components/shared/PrivacyNotice` | subtle "secure" line + a "?" disclosure whose items derive from real capabilities (`data/privacyNotice` SSOT); reused on upload + Help |
| Match highlight | `components/shared/Highlight` | wraps matched search substrings in `<mark>` over the `utils/search` `hlParts` SSOT; used by every scoped search list |
| Mobile bottom nav | `components/mobile/MobileTabBar` | thumb-reachable primary tabs from the navConfig SSOT (group before the first section) |
| Pager | `components/shared/Pager` | shared list pagination |
| ShareMenu | `components/shared/ShareMenu` | WhatsApp/Email |
| ErrorBoundary | `components/shared/ErrorBoundary` | recovers on navigation |
| Skeletons | `.skeleton` (global.css) | loading states; route-load skeleton (`PageFallback`) carries a polite `role="status"` announcement |
| `.sr-only` | global.css | polite live-region announcements |

Duplication is CI-guarded (jscpd); reuse before adding. The single-source map
lives in ARCHITECTURE.md.

## 6. Accessibility (WCAG 2.2 AA)

Verified by axe across all routes + overlays, a token contrast audit (both
themes), and keyboard-flow tests. Skip link, landmarks, heading-order guard,
`aria-current` nav state, labelled icon buttons, live regions for async changes
(calendar view announcements), TTS affordances hidden when unsupported (no dead
buttons). Writing rules for a11y: CONTENT_GUIDE § 6.

## 7. Motion

Purposeful and short (≤300ms): state feedback, not decoration. Calendar loading
bar, sheet slide-ups, sidebar drawer. Everything honors reduced-motion.
