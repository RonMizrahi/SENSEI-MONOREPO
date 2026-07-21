// Shared clinical disclaimer for AI-generated artifacts (prep report, and any
// other AI output). A quiet muted footer: the output is a documentation aid, not
// a diagnosis — clinical judgment stays with the therapist. Single source of
// truth for the wording so it can't drift across screens.
export const CLINICAL_DISCLAIMER =
  'תוכן זה נוצר אוטומטית ככלי עזר לתיעוד. אינו מהווה אבחנה או המלצה קלינית, והאחריות המקצועית ושיקול הדעת הקליני נותרים בידיכם.';

export default function AiDisclaimer({ text = CLINICAL_DISCLAIMER }: { text?: string }) {
  return (
    <div role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--text-muted)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
        <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      </svg>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}
