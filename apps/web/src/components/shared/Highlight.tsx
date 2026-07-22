// Shared match-highlight renderer over the canonical search SSOT (utils/search
// hlParts). Wraps the matched substring of `text` in <mark> so every search
// result list (roster · archive · meeting-history directory · FAQ) highlights
// matches consistently with the global ⌘K / search-page results. RTL-safe;
// <mark> is announced by screen readers as emphasized.
import { hlParts } from '../../utils/search';

export default function Highlight({ text, query }: { text: string; query: string }) {
  const parts = hlParts(text, (query || '').trim());
  return (
    <>
      {parts.map((p, i) => (p.hi
        ? <mark key={i} style={{ background: p.bg, color: 'inherit', fontWeight: p.fw, borderRadius: 3, padding: '0 1px' }}>{p.t}</mark>
        : <span key={i}>{p.t}</span>
      ))}
    </>
  );
}
