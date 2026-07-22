// Canonical / architecture / drift enforcement (deterministic, low-noise).
// Static-analysis-as-tests: every consolidated concept must have exactly one
// definition, leaf modules must not depend on UI/state, docs must exist, and
// hardcoded color usage must not grow. These guards make duplication and drift
// fail CI instead of re-entering silently. See CONTRIBUTING.md § Enforcement.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.test(name)) out.push(p);
  }
  return out;
}
const tsFiles = walk(SRC, /\.tsx?$/).filter((f) => !/\.test\./.test(f));
const rel = (p: string) => p.slice(ROOT.length + 1);

// --- Single Source of Truth: each canonical symbol defined in exactly one file ---
describe('Single source of truth — canonical symbols defined once', () => {
  const CANONICAL: Record<string, string> = {
    // search / format utils
    scoreP: 'src/utils/search.ts', hlParts: 'src/utils/search.ts', normHe: 'src/utils/search.ts',
    // shared style + icon + data constants
    CARD_SHADOW: 'src/utils/styles.ts', labelStyle: 'src/utils/styles.ts',
    SUN: 'src/utils/themeIcons.ts', MOON: 'src/utils/themeIcons.ts', MONITOR: 'src/utils/themeIcons.ts',
    SHORTCUTS: 'src/data/shortcuts.ts',
    SESSION_DATES: 'src/data/sessions.ts', sessionSummaries: 'src/data/sessions.ts', sessionRisk: 'src/data/sessions.ts',
    NOTIFS: 'src/data/catalogs.ts', MOCK_PATIENTS: 'src/data/mockPatients.ts',
    // core utils + nav
    riskMeta: 'src/utils/index.ts', avatarColors: 'src/utils/index.ts', validateFile: 'src/utils/index.ts',
    getPatient: 'src/utils/index.ts', hg: 'src/utils/index.ts', hgTerm: 'src/utils/index.ts',
    navConfig: 'src/nav/navConfig.ts', ROUTE_TITLES: 'src/nav/navConfig.ts',
    routeToHash: 'src/nav/urlHash.ts', parseHash: 'src/nav/urlHash.ts',
  };
  const defsOf = (name: string) =>
    tsFiles.filter((f) => new RegExp(`^(?:export\\s+)?(?:function|const)\\s+${name}\\b`, 'm').test(readFileSync(f, 'utf8')));

  for (const [name, home] of Object.entries(CANONICAL)) {
    it(`${name} — one definition, in ${home}`, () => {
      const defs = defsOf(name).map(rel);
      expect(defs, `expected only ${home}`).toEqual([home]);
    });
  }
});

// --- Architecture: leaf modules must not depend on UI / state / pages ---
describe('Architecture — no forbidden cross-layer imports', () => {
  it('leaf modules (utils/data/hooks/nav/services/types) do not import from pages/components/store', () => {
    const leaves = tsFiles.filter((f) => /\/src\/(utils|data|hooks|nav|services|types)\//.test(f));
    const bad: string[] = [];
    for (const f of leaves) {
      const t = readFileSync(f, 'utf8');
      if (/from '[^']*\/(pages|components|store)\//.test(t) || /from '\.\.\/store'/.test(t)) bad.push(rel(f));
    }
    expect(bad, `leaf modules importing UI/state:\n${bad.join('\n')}`).toEqual([]);
  });

  it('no page imports another page (would create coupling/cycles)', () => {
    const pages = tsFiles.filter((f) => /\/src\/pages\/[A-Za-z]+Page\.tsx$/.test(f));
    const bad: string[] = [];
    for (const f of pages) {
      const t = readFileSync(f, 'utf8');
      if (/from '\.\/[A-Za-z]+Page'/.test(t)) bad.push(rel(f));
    }
    expect(bad, `page→page imports:\n${bad.join('\n')}`).toEqual([]);
  });
});

// --- Documentation drift: required docs must exist ---
describe('Documentation — required docs present', () => {
  for (const doc of ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'ARCHITECTURE.md', '.env.example']) {
    it(`${doc} exists`, () => expect(existsSync(join(ROOT, doc)), `${doc} is required`).toBe(true));
  }
});

// --- RTL: no physical direction properties (this app is Hebrew-only RTL) ---
describe('RTL — no physical direction properties in JSX (use logical props)', () => {
  // Physical props (marginLeft, paddingRight, textAlign:'left'…) do NOT flip for
  // RTL. The app uses logical props (marginInlineStart, insetInlineEnd, textAlign
  // 'start'/'end') everywhere; this keeps it that way so nothing renders mirrored.
  it('uses no marginLeft/Right, paddingLeft/Right, borderLeft/Right, or textAlign left/right', () => {
    const re = /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight)\b|textAlign:\s*['"](left|right)['"]/;
    const hits: string[] = [];
    for (const f of tsFiles.filter((f) => f.endsWith('.tsx'))) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((ln, i) => { if (re.test(ln)) hits.push(`${rel(f)}:${i + 1}`); });
    }
    expect(hits, `Physical direction props (use logical equivalents):\n${hits.join('\n')}`).toEqual([]);
  });
});

// --- Design-token ratchet: hardcoded hex colors must not grow past the baseline ---
describe('Design tokens — hardcoded hex does not increase past baseline', () => {
  // The only sanctioned raw hex outside styles/tokens.css is AVATAR_PALETTE in
  // src/utils/index.ts (8 entries) — avatarColors() derives tint/lighten values
  // arithmetically, which CSS variables can't feed. Everything else consumes
  // var(--token). Scans .ts AND .tsx. Lower on further reduction — never raise.
  // (History: 82 → 66 → 8 in the global color-standardization pass; whites went
  // to var(--on-accent), status hexes to semantic tokens, the profile picker's
  // off-system purple/green/amber/red swatches were removed, and the meta
  // theme-color now reads the computed --bg token.)
  const BASELINE = 8;
  it(`count <= ${BASELINE}`, () => {
    const re = /['"]#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?['"]/g;
    let n = 0;
    for (const f of tsFiles.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) n += (readFileSync(f, 'utf8').match(re) || []).length;
    expect(n, 'new hardcoded hex introduced — use a var(--token) instead').toBeLessThanOrEqual(BASELINE);
  });
});

// --- Documentation drift: release version is one number, stated the same everywhere ---
describe('Documentation — release version is consistent across sources', () => {
  // The existing docs guard proves the files EXIST; this proves they are not
  // stale relative to the release number. package.json is the source of truth;
  // the newest CHANGELOG heading and the README version badge must match it, so
  // a version bump can't land in one place and drift in the others.
  it('package.json version === newest CHANGELOG entry === README version badge', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;
    const clTop = (readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').match(/##\s*\[(\d+\.\d+\.\d+)\]/) || [])[1];
    const rmVer = (readFileSync(join(ROOT, 'README.md'), 'utf8').match(/\*\*Version:\*\*\s*(\d+\.\d+\.\d+)/) || [])[1];
    expect(clTop, 'newest CHANGELOG heading must match package.json version').toBe(pkg);
    expect(rmVer, 'README version badge must match package.json version').toBe(pkg);
  });
});

// --- Copy integrity: UI must not promise data behavior the code does not perform ---
describe('Copy integrity — action confirmations make no unbacked archive/audit claim', () => {
  // Action confirmations (delete patient / delete session dialogs + toasts, summary-approval
  // status) offer an immediate undo only — there is no audit-log writer and no N-day retention
  // store. So this copy must not promise activity-log logging or fixed-term recovery (regressions
  // fixed in 1.0.13/1.0.15). Capability/policy descriptions (Help FAQ, Documents note) that
  // represent the product's audit feature are intentionally out of scope — see CONTRIBUTING.
  it('delete/summary action copy promises no activity-log logging or N-day retention', () => {
    const ACTION_FILES = ['components/layout/Dialogs.tsx', 'pages/SummaryPage.tsx'];
    const AUDIT = /ביומן\s*הפעילות/; // "…recorded in the activity log"
    const RETENTION = /\d+\s*יום/; //   "…N days" retention / recovery window
    const offenders: string[] = [];
    for (const rf of ACTION_FILES) {
      readFileSync(join(SRC, rf), 'utf8').split('\n').forEach((l, i) => {
        if (AUDIT.test(l) || RETENTION.test(l)) offenders.push(`${rf}:${i + 1}  ${l.trim().slice(0, 60)}`);
      });
    }
    expect(offenders, 'action copy must match behavior: immediate undo only — no audit log, no N-day retention').toEqual([]);
  });
});

// --- Accessibility: heading levels must not skip (no h1 → h3 jump) ---
describe('Accessibility — heading order does not skip a level', () => {
  // Screen readers navigate by heading level; skipping one (e.g. an empty-state <h3>
  // directly under a page <h1>, with no <h2>) misrepresents structure. Every view here
  // is self-contained with a flat h1→h2→h3 order, so any .tsx using <h3> must also use
  // <h2>. Headings carry explicit inline font-size, so the tag is semantic-only — fixing
  // a skip never changes appearance. axe can't catch these (empty states don't render in
  // the route tests). Fixed a real h1→h3 skip on 5 empty states + the notifications title.
  it('every .tsx using <h3> also uses <h2>, and no <h4>–<h6> deep jumps exist', () => {
    const skips: string[] = [];
    for (const f of tsFiles.filter((f) => f.endsWith('.tsx'))) {
      const src = readFileSync(f, 'utf8');
      if (/<h3[\s>]/.test(src) && !/<h2[\s>]/.test(src)) skips.push(rel(f) + ' — <h3> without <h2>');
      if (/<h[4-6][\s>]/.test(src)) skips.push(rel(f) + ' — unexpected <h4>–<h6>');
    }
    expect(skips, 'heading level skipped — use the next level down (h1→h2→h3)').toEqual([]);
  });
});

// --- Content: no emoji in user-facing source (product convention + a11y + localization) ---
describe('Content — no emoji in UI strings', () => {
  // The product convention (see CONTENT_GUIDE.md) forbids emoji in the UI: they render
  // inconsistently across platforms, degrade screen-reader output, and don't localize.
  // Functional iconography (arrows ↑↓, restore ↺, bullet →) is fine — this guards the
  // emoji plane only (U+1F000–1FAFF), catching pasted-in emoji without flagging glyphs.
  it('no .ts/.tsx source contains an emoji (U+1F000–1FAFF)', () => {
    const re = /[\u{1F000}-\u{1FAFF}]/u;
    const hits: string[] = [];
    for (const f of tsFiles) {
      readFileSync(f, 'utf8').split('\n').forEach((ln, i) => { if (re.test(ln)) hits.push(`${rel(f)}:${i + 1}`); });
    }
    expect(hits, 'remove the emoji — use plain text or a Design-System icon').toEqual([]);
  });
});

// --- Production safety: dev-only demo affordances must be build-gated ---
describe('Content — dev-only demo affordances are gated out of production', () => {
  // The auth screen's "מצבי מסך (הדגמה)" state-preview links (jump to the expired /
  // unauthorized screens) are a dev/design-review tool, not for real users. They must
  // sit behind `import.meta.env.DEV` so Vite tree-shakes them from the production build.
  it('the auth demo state-preview block is wrapped in import.meta.env.DEV', () => {
    const src = readFileSync(join(SRC, 'pages/auth/AuthScreens.tsx'), 'utf8');
    const demoIdx = src.indexOf('מצבי מסך');
    if (demoIdx >= 0) {
      const guardIdx = src.lastIndexOf('import.meta.env.DEV', demoIdx);
      expect(guardIdx >= 0 && demoIdx - guardIdx < 400,
        'the demo state-preview links must be DEV-gated (hidden in production builds)').toBe(true);
    }
  });
});

// --- Copy style: no em dash / long dash in Hebrew user-facing copy ---
describe('Content — no em dash in Hebrew copy', () => {
  // House style (see CONTENT_GUIDE.md): Hebrew copy uses ·, :, a comma, or a period
  // instead of an em dash "—" (a common AI-tell and inconsistent separator). The
  // standalone "—" empty-value placeholder and English code comments are exempt.
  it('no em dash (—) sits adjacent to Hebrew text', () => {
    const re = /[א-ת].{0,2}—|—.{0,2}[א-ת]/; // Hebrew letter within 2 chars of an em dash
    const hits: string[] = [];
    for (const f of tsFiles) {
      readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
        const code = ln.replace(/\/\/.*$/, ''); // drop line comments (dev-facing, English)
        if (/['"]—['"]/.test(code)) return; // the standalone empty-value placeholder is fine
        if (re.test(code)) hits.push(`${rel(f)}:${i + 1}`);
      });
    }
    expect(hits, 'use ·, :, a comma, or a period instead of an em dash in Hebrew copy').toEqual([]);
  });
});

// --- Assets: every shipped image must be referenced (no dead media weight) ---
describe('Assets — no unreferenced images in public/assets', () => {
  // Everything under public/ ships as-is in the production build, referenced or not.
  // Each image must appear somewhere in the source (JSX/CSS/index.html) so dead media
  // (e.g. a 928 KB unused PNG) can't silently bloat every deployment.
  it('every public/assets image is used in source', () => {
    const dir = join(ROOT, 'public/assets');
    const imgs = readdirSync(dir).filter((f) => /\.(png|jpe?g|svg|webp|gif)$/i.test(f));
    const haystack = [...tsFiles, ...walk(SRC, /\.css$/), join(ROOT, 'index.html')]
      .map((f) => readFileSync(f, 'utf8')).join('\n');
    const dead = imgs.filter((img) => !haystack.includes(img));
    expect(dead, `unreferenced image(s) in public/assets — remove them or wire them up:\n${dead.join('\n')}`).toEqual([]);
  });
});

// --- Deploy: cache-control split (immutable hashed assets, revalidated HTML) ---
describe('Deploy — cache-control avoids the stale-UI trap', () => {
  // Content-hashed /assets/* cache forever; HTML (index + SPA routes) must revalidate so
  // a returning user always gets fresh HTML pointing at the current asset hashes. Guards
  // both host configs so this split can't silently regress and serve stale UI / dead chunks.
  it('vercel.json and _headers set immutable assets + must-revalidate HTML', () => {
    for (const rel of ['vercel.json', 'public/_headers']) {
      const cfg = readFileSync(join(ROOT, rel), 'utf8');
      expect(cfg, `${rel}: /assets/* must be immutable`).toMatch(/assets[\s\S]*max-age=31536000[\s\S]*immutable/);
      expect(cfg, `${rel}: HTML must revalidate`).toMatch(/max-age=0[^\n]*must-revalidate/);
    }
  });
});

// --- Contrast: on-accent text uses a theme token, not hardcoded #fff ---
describe('Contrast — on-accent surfaces adapt per theme', () => {
  // #fff on var(--primary) fails AA in dark mode, where --primary lightens (the skip
  // link measured 3.06:1). On-accent text must use var(--paper) so it flips with the
  // theme — the 1.4.3 on-accent contract (same class as the 1.0.9 dark-mode fix).
  it('.skip-link uses var(--paper), not #fff, on its primary background', () => {
    const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    const rule = css.match(/\.skip-link\{[^}]*\}/)?.[0] || '';
    expect(rule).toContain('background:var(--primary)');
    expect(rule, 'on-accent text must adapt per theme — use var(--paper)').not.toMatch(/color:\s*#fff/);
  });
  it('placeholders use the muted token (not the sub-AA browser default)', () => {
    // No ::placeholder rule → the UA default (#757575 ≈ 4.05:1) is used. Pin it to a
    // token that meets AA in both themes.
    const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    expect(css, 'define ::placeholder color via a token').toMatch(/::placeholder\{[^}]*color:var\(--text-muted\)/);
  });
  it('form-control text is pinned to the design token (not the browser color-scheme default)', () => {
    // Inputs/textareas/selects don't reliably inherit `color`; leaving it to the UA means
    // the entered-text colour is browser-decided. Pin it to --text so it is AA and
    // token-consistent in both themes.
    const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    expect(css, 'pin input/textarea/select colour to --text').toMatch(/input,\s*textarea,\s*select\s*\{\s*color:\s*var\(--text\)/);
  });
  it('accent-card gradient + on-accent text are tokenized and darken in dark mode', () => {
    // Brand accent cards used the primary gradient directly; in dark mode --primary is
    // light enough that white text drops below AA. The gradient stops + on-accent text are
    // now tokens that darken for dark mode. No page may hardcode the raw primary gradient
    // on a text-bearing accent card.
    const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    for (const tok of ['--accent-grad-1', '--accent-grad-2', '--on-accent']) {
      expect(css, `token ${tok} must be defined`).toContain(tok);
    }
    // dark theme overrides the stops to darker values (not the light primary refs)
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(darkBlock, 'dark mode must darken --accent-grad-2').toMatch(/--accent-grad-2:\s*#[0-9A-Fa-f]{6}/);
  });
  it('the palette\'s "recent patients" is genuinely recent (backed by tracked history)', () => {
    // The ⌘K palette shows a "מטופלים אחרונים" (recent patients) section on an empty
    // query. It must be fed by real navigation history (recentPatientIds), not a static
    // slice of the list, or the label lies. The store must track it on navigate.
    const palette = readFileSync(join(SRC, 'components/layout/CommandPalette.tsx'), 'utf8');
    expect(palette, 'palette must read recentPatientIds').toMatch(/recentPatientIds/);
    const store = readFileSync(join(SRC, 'store/AppStore.tsx'), 'utf8');
    expect(store, 'navigate must record recent patients').toMatch(/recentPatientIds\s*=\s*pushRecent/);
    expect(store, 'recentPatientIds must survive reloads').toMatch(/'recentPatientIds'/);
  });
  it('Help is reachable from anywhere (navConfig destination) — the "?" lives only there, not the header', () => {
    // Help is a first-class navConfig destination (→ sidebar + ⌘K palette + global
    // search from one source). The "?" help icon was removed from the global app bar
    // by design (kept contextual to the sidebar + Help page), so it must NOT re-appear
    // in the header.
    const nav = readFileSync(join(SRC, 'nav/navConfig.ts'), 'utf8');
    expect(nav, "help must be a navConfig destination").toMatch(/key:\s*'help'/);
    // The global top bar was removed app-wide; app chrome now lives in the sidebar,
    // which must NOT add a standalone "?" help control (help stays data-driven via navConfig).
    const sidebar = readFileSync(join(SRC, 'components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar, 'the "?" help control must NOT be hard-wired into the sidebar chrome').not.toMatch(/navigate\(\s*'help'\s*\)/);
    // Help must not be double-listed in the palette (it now comes from navConfig).
    const palette = readFileSync(join(SRC, 'components/layout/CommandPalette.tsx'), 'utf8');
    const cmdActions = palette.match(/CMD_ACTIONS[\s\S]*?\n {2}\]/)?.[0] || '';
    expect(cmdActions, "help must not be re-declared as a static palette command").not.toMatch(/navigate\('help'\)/);
  });
  it('a print stylesheet isolates the clinical letter (window.print must not print app chrome)', () => {
    // LetterPage has a working "הדפסה" (window.print) button. Without an @media print
    // rule, it prints the whole app — sidebar, app bar, buttons. The print block must
    // hide the app chrome and anything tagged .no-print so a clean document reaches paper.
    const css = readFileSync(join(SRC, 'styles/global.css'), 'utf8');
    const block = css.match(/@media print\s*\{[\s\S]*?\n\}/)?.[0] || '';
    expect(block, 'global.css must define an @media print block').not.toBe('');
    for (const sel of ['.app-sidebar', '.nav-toggle', '.shell-fab', '.no-print']) {
      expect(block, `print must hide ${sel}`).toContain(sel);
    }
    expect(block, 'hidden chrome must use display:none').toMatch(/display:\s*none/);
    // and the letter page must actually tag its interactive chrome with .no-print
    const letter = readFileSync(join(SRC, 'pages/LetterPage.tsx'), 'utf8');
    expect((letter.match(/className="no-print"/g) || []).length, 'LetterPage must mark chrome no-print').toBeGreaterThanOrEqual(2);
  });
  it('every patient sub-page offers a breadcrumb back to the patient (consistent navigation)', () => {
    // In this router-less SPA there is no browser Back, so each patient sub-screen must
    // provide a breadcrumb link to the patient. This keeps all sub-pages consistent (a *-crumb element + a navigate('patient') handler).
    for (const page of ['SummaryPage', 'PatientMeetingHistoryPage', 'SessionDetailPage', 'ReportPage', 'LetterPage', 'TranscriptPage']) {
      const src = readFileSync(join(SRC, `pages/${page}.tsx`), 'utf8');
      expect(src, `${page} must render a breadcrumb ("-crumb" element)`).toMatch(/className="[a-z]+-crumb"/);
      expect(src, `${page} breadcrumb must navigate back to the patient`).toMatch(/navigate\(\s*'patient'/);
    }
  });
  it('the closed mobile nav drawer is hidden from tab order + AT (visibility:hidden)', () => {
    // The off-canvas sidebar slides off-screen via transform when closed, but transform
    // alone leaves its 14 nav links keyboard-focusable and announced by screen readers
    // (WCAG 2.4.3). The mobile drawer rule must set visibility:hidden when closed and
    // restore visibility on .open, so closed links leave the tab order + accessibility tree.
    const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    const mq = css.match(/@media \(max-width:860px\)\s*\{[\s\S]*?\n {2}\}/)?.[0] || '';
    expect(mq, 'mobile drawer media query must exist').not.toBe('');
    const base = mq.match(/\.app-sidebar\{[^}]*\}/)?.[0] || '';
    const open = mq.match(/\.app-sidebar\.open\{[^}]*\}/)?.[0] || '';
    expect(base, 'closed drawer must be visibility:hidden').toMatch(/visibility:\s*hidden/);
    expect(open, 'open drawer must restore visibility').toMatch(/visibility:\s*visible/);
  });
});
