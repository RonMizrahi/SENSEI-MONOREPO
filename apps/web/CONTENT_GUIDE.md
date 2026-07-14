# Content & Voice Guide — Sensei (סנסיי)

The single source of truth for every piece of user-facing text in the Sensei frontend.
It documents the voice, terminology, and microcopy patterns **already in use** — this is a
description of the shipped product's content, made canonical, not a redesign of it.

> **Scope.** Sensei is a Hebrew-only, RTL, client-side practice-management app for **licensed
> therapists**. This guide governs the product UI. Sections that don't exist in this product
> (marketing pages, emails/SMS/push, presentations, multilingual copy) are marked **N/A** — see
> the last section. Don't invent content for surfaces the product doesn't have.

---

## 1. Voice — who Sensei is

Sensei is a **calm, competent clinical assistant** speaking to a professional peer. It is:

| Trait | Level | In practice |
|---|---|---|
| Professionalism | High | Clinical register; never casual slang, never breezy. |
| Warmth | Moderate | Supportive and human, not cold — but never gushing. |
| Confidence | High, humble | States what it knows; flags uncertainty plainly (esp. AI output). |
| Empathy | Present, restrained | Acknowledges effort ("העבודה שלכם נשמרה") without emotional performance. |
| Humor | None | This is clinical software about vulnerable people. Never joke. |
| Transparency | Absolute | Says exactly what happened. Never over-promises (see §5). |

**Address the user in plural/formal voice (לשון רבים):** "וודאו", "תוכלו", "נסו". Never singular-imperative.
**Never** use: marketing buzzwords, "AI-magic" language, exclamation-driven hype, or emoji.

---

## 2. Terminology dictionary (one concept → one word)

The app already holds these to a single term each. Do not introduce synonyms.

| Concept | Canonical term | Never |
|---|---|---|
| Patient | **מטופל / מטופלת** (gendered via `HG`) | לקוח, מבוטח, משתמש |
| Session (appointment) | **פגישה** | מפגש, תור, ביקור |
| Transcript | **תמלול** | תעתיק |
| AI summary | **סיכום** | תקציר |
| Risk flag | **סיכון** (נמוך / בינוני / גבוה) | סכנה, אזהרה |
| Treatment goals | **מטרות טיפול** | יעדים |
| Prep report | **דוח הכנה** | — |
| Recording | **הקלטה** | אודיו |
| Activity log (view) | **יומן פעילות** | לוג, היסטוריה |

**Gendered Hebrew** is handled by `public/hebrew-grammar.js` (`window.HG.term` / `.fill`) driven by the
profile's stored gender — not by hand-writing "מטופל/ת". Add new gendered nouns to `HG`, not inline slashes.

**Brand name:** the wordmark is **סנסיי** (Hebrew) in the UI, **Sensei** in Latin/technical contexts
(docs, metadata `application-name`). Keep each consistent to its context.

---

## 3. Microcopy patterns

- **Buttons = verb-first actions:** "מטופל חדש", "אישור מיזוג", "חזרה לדף הבית". Not vague ("אישור" alone, "המשך" with no object where avoidable).
- **Labels are nouns; helper text is a short instruction.** Required fields marked; validation is inline and specific.
- **Technical strings are `dir="ltr"`:** phone, email, date, license number, time — always wrapped so digits/punctuation render correctly inside RTL.
- **AI output carries a humility line:** e.g. "סנסיי מבוסס על סיכומים שנותחו ועשוי לטעות · אינו תחליף לשיקול דעת קליני." Any AI-generated surface must disclaim.

### Empty states — explanation + context (+ action where one exists)
Pattern: a heading (`<h2>`) + one supporting line. Add a next-action CTA **only** when there is a real
next step (e.g. Patients "אין מטופלים עדיין" → "מטופל חדש"; a filtered no-match → "ניקוי החיפוש והמסננים").
Positive/terminal empties ("לא נמצאו כפילויות", "אין התראות") take **no** CTA — a button there is noise.

### Loading states
Use the shared skeleton shimmer (`.skeleton`) or a progress indicator — never a raw "טוען…" jump.

### Error / recovery states
Explain what happened + how to recover, calmly: "משהו השתבש במסך הזה · העבודה שלכם נשמרה. נסו לרענן…".
Never expose developer/stack text. Keep failures observable to the user, not alarming.

### Success / confirmation
State the concrete outcome: "הרשומות מוזגו · N רשומה כפולה הוסרה מהרשימה". Offer undo where it exists ("ניתן לבטל").

### Share affordances (WhatsApp / Email)
The `ShareMenu` (on the clinical letter and on resources) opens a two-option menu: **שיתוף ב-WhatsApp** and
**שליחה באימייל**; the trigger reads **שיתוף** or a context label (**שיתוף למטופל**). Product names stay Latin
(`WhatsApp`), per §2. Share **only the content already on screen** — never internal IDs, tokens, URLs, or system
metadata; recipients are never pre-filled (no PII). When the content carries patient details (the clinical
letter), the menu opens with a restrained warning line first — "המכתב כולל פרטי מטופל. שתפו רק עם נמען מורשה
ובערוץ מאובטח בהתאם לנהלי המרפאה." — truthful guidance, not alarm (§5). Confirmation toasts state the concrete
hand-off ("נפתח שיתוף ב-WhatsApp", "נפתחת טיוטת אימייל לשיתוף").

---

## 4. Hebrew & RTL rules

- 100% logical CSS (`insetInline*`, `marginInline*`, `textAlign: start/end`) — enforced by a guard; no physical `left/right`.
- Native Hebrew phrasing, never literal English translation. Sentence structure reads naturally aloud.
- Punctuation: use "·" as a soft separator; wrap LTR technical values in `<span dir="ltr">`.
- Numbers/dates in DD.MM.YYYY, LTR-wrapped.
- **No em dash / long dash ("—") in copy.** It reads as an AI-tell and separates inconsistently.
  Use instead: **·** for an inline label chain (`PTSD · קיפאון בטיפול`), **:** for a label then its
  detail (`סיכום הדרכה: טכניקות`), or a **period / comma** to split an action from its follow-up
  (`הבקשה נשלחה. נחזור אליכם`). Guarded in CI. The standalone `—` empty-value placeholder (`phone: '—'`)
  is exempt — it is a data indicator, not prose.
- Hyphens: avoid them in copy, but Hebrew prefix hyphens (`ב־`, `ל־`, `ה־`) and technical values
  (dates, `HH:MM`, license numbers) are grammatically required and stay.

---

## 5. Truthfulness (a hard rule, guarded in CI)

**Never describe a system behavior the code does not perform.** This is content's most load-bearing rule here:
action-confirmation copy must match what actually happens. The app was corrected so merge/delete copy no
longer claims "archived / restorable in 30 days / logged to the activity log" when only an immediate undo
exists. Capability descriptions (e.g. the Help FAQ describing the audit-log feature) are allowed as product
representation; **per-action confirmations must be literally true.** Enforced by the copy-integrity guard.

---

## 6. Accessibility writing

- Every control has an accessible name (`aria-label` where the visible text is an icon).
- Plain, scannable language; short sentences; front-loaded meaning.
- **No emoji** — inconsistent across AT/platforms and unlocalizable. Use a Design-System icon or plain text. (Guarded.)
- Status changes announced via `role="status"` / `aria-live` (toasts, demo-mode banner, search result counts).

---

## 7. Governance — how this stays true automatically

These are enforced in `tests/canonical.test.ts` (see [CONTRIBUTING.md](CONTRIBUTING.md) § Enforcement), so
future content can't silently drift:

| Rule | Guard |
|---|---|
| One term per concept (canonical symbols/data) | single-source-of-truth guard |
| No emoji in UI strings (U+1F000–1FAFF) | emoji guard |
| Action copy matches behavior (no false archive/audit/retention) | copy-integrity guard |
| Heading order not skipped | heading-order guard |
| No new hardcoded color literals | design-token ratchet |

New screens/features must reuse these terms and patterns and pass the guards. When copy changes, update this
guide in the same PR.

---

## 8. Explicitly N/A for this product (do not fabricate)

- **Marketing / landing pages, server-sent emails, SMS, push notifications** — none exist; this is an
  authenticated app shell. The app never sends or receives messages itself. The Letter and Resources screens
  can hand a **pre-composed** WhatsApp/email share to the user's *own* client (`wa.me` / `mailto`) — user-initiated,
  no server messaging channel; see §3 "Share affordances".
- **Presentations / slides** — none in this repo.
- **Multilingual / localization keys** — the product is deliberately **Hebrew-only**; there is no i18n layer. "Design for translation" here means clean externalizable phrasing and RTL correctness, not a translation system.
- **Storybook / Figma sync** — not used (see ARCHITECTURE.md). The Design System is the CSS-variable token set in `tokens.css`, not MUI/Storybook.
