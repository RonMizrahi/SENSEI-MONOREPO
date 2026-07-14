/* ============================================================================
 * Sensei · Hebrew Grammar & Localization Layer  (window.HG)
 * ----------------------------------------------------------------------------
 * A single, centralized source of truth for gendered Hebrew microcopy.
 * No component hardcodes gendered strings; they call into this layer instead.
 *
 * Core idea: every gendered phrase is authored with ALL its forms inline, and
 * resolved once against a known gender. Two authoring styles are supported:
 *
 *   1. Inline template tokens — for running prose (AI text, reports, notes):
 *        HG.fill('[[מטופל|מטופלת]] [[דיווח|דיווחה]] על שיפור', gender)
 *      Each [[masc|fem|neutral]] block is resolved by gender. The 3rd
 *      (neutral) form is optional; when gender is unknown the neutral form is
 *      used if present, otherwise the unmarked (masculine) form — never a slash.
 *
 *   2. Named dictionary terms — for reusable UI nouns/labels:
 *        HG.term('patient', gender)      → מטופל / מטופלת / (neutral) מטופל
 *        HG.term('patient', gender, {def:true})  → prefix ה־  (המטופל / המטופלת)
 *
 * Gender input is liberal: accepts 'm'/'f', Hebrew 'ז'/'נ', 'זכר'/'נקבה',
 * 'male'/'female', or a profile's stored preference. Anything else → unknown.
 *
 * Roles table is extensible: patient, therapist, admin, orgManager, supervisor
 * are defined today; add a key to ROLES to support a new role tomorrow.
 * ========================================================================== */
(function () {
  'use strict';

  // ---- gender normalization → 'm' | 'f' | 'u' (unknown/unspecified) --------
  var MASC = ['m', 'male', 'man', 'he', 'ז', 'זכר', 'masc', 'masculine'];
  var FEM  = ['f', 'female', 'woman', 'she', 'נ', 'נקבה', 'fem', 'feminine'];

  function norm(g) {
    if (g == null) return 'u';
    var s = String(g).trim().toLowerCase();
    // Hebrew letters won't lower-case; check raw too
    var raw = String(g).trim();
    if (MASC.indexOf(s) !== -1 || MASC.indexOf(raw) !== -1) return 'm';
    if (FEM.indexOf(s) !== -1 || FEM.indexOf(raw) !== -1) return 'f';
    return 'u';
  }

  // ---- low-level: pick one of [masc, fem, neutral?] by gender --------------
  function pick(forms, g) {
    var n = norm(g);
    var m = forms[0], f = forms[1], u = forms.length > 2 ? forms[2] : undefined;
    if (n === 'm') return m != null ? m : (u != null ? u : f);
    if (n === 'f') return f != null ? f : (u != null ? u : m);
    // unknown → neutral form if authored, else unmarked masculine (never a slash)
    return u != null ? u : m;
  }

  // ---- inline token resolver: "[[m|f|u]] regular text [[m|f]]" -------------
  var TOKEN = /\[\[([^\]]*)\]\]/g;
  function fill(tpl, g) {
    if (tpl == null) return tpl;
    return String(tpl).replace(TOKEN, function (_, body) {
      return pick(body.split('|'), g);
    });
  }

  // ---- named role/term dictionary ------------------------------------------
  // Each entry: [masculine, feminine, neutral?]. Neutral defaults to the
  // unmarked (masculine) generic when omitted — the standard slash-free default
  // for mixed/unknown audiences.
  var ROLES = {
    patient:      ['מטופל', 'מטופלת'],
    therapist:    ['מטפל', 'מטפלת'],
    admin:        ['מנהל', 'מנהלת'],
    orgManager:   ['מנהל ארגון', 'מנהלת ארגון'],
    supervisor:   ['מדריך', 'מדריכה'],
    user:         ['משתמש', 'משתמשת'],
  };

  function term(key, g, opts) {
    opts = opts || {};
    var forms = ROLES[key];
    if (!forms) return key;
    var w = pick(forms, g);
    return opts.def ? withDef(w) : w;
  }

  // add the definite article ה־ to a Hebrew word
  function withDef(w) {
    if (!w) return w;
    return 'ה' + w;
  }

  // ---- register/extend roles at runtime (future expansion) -----------------
  function defineRole(key, masc, fem, neutral) {
    ROLES[key] = neutral != null ? [masc, fem, neutral] : [masc, fem];
  }

  window.HG = {
    norm: norm,
    pick: pick,
    fill: fill,
    term: term,
    withDef: withDef,
    defineRole: defineRole,
    ROLES: ROLES,
  };
})();
