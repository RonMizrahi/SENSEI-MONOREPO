// Canonical search helpers — single source of truth for patient relevance
// ranking and query highlighting. Consumed by the ⌘K command palette, the app
// bar global search, the patients list, and the search results page.
// (Consolidated from previously-duplicated per-file copies.)

// Normalize Hebrew for matching: strip niqqud (U+0591–U+05C7) and geresh/
// gershayim, lowercase-insensitive trim.
export const normHe = (s: any): string =>
  (s || '').toString().replace(/[֑-ׇ]/g, '').replace(/['"׳״]/g, '').trim();

// Relevance score for a patient against a query. Higher = better; 0 = no match.
export function scoreP(p: any, q: string): number {
  const qq = normHe(q); if (!qq) return 0;
  const name = normHe(p.name), phone = (p.phone || '').replace(/\D/g, ''), email = (p.email || '').toLowerCase();
  if (name === qq) return 7;
  if (name.startsWith(qq)) return 6;
  if (name.includes(qq)) return 5;
  const digits = qq.replace(/\D/g, '');
  if (phone && digits && phone.includes(digits)) return 2;
  if (email && qq.length > 1 && email.includes(qq.toLowerCase())) return 1.5;
  return 0;
}

export interface HlPart { t: string; hi: boolean; bg: string; fw: any }

// Split `text` into highlighted/plain parts around the first occurrence of `q`.
export function hlParts(text: any, q: string): HlPart[] {
  const withBg = (arr: { t: string; hi: boolean }[]) =>
    arr.map((x) => ({ ...x, bg: x.hi ? 'var(--selection)' : 'transparent', fw: x.hi ? 700 : ('inherit' as any) }));
  const t = (text || '').toString(); const qq = (q || '').trim();
  if (!qq) return withBg([{ t, hi: false }]);
  const idx = t.indexOf(qq);
  if (idx < 0) return withBg([{ t, hi: false }]);
  return withBg([
    { t: t.slice(0, idx), hi: false },
    { t: t.slice(idx, idx + qq.length), hi: true },
    { t: t.slice(idx + qq.length), hi: false },
  ].filter((x) => x.t !== ''));
}
