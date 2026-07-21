// Suspense fallback for lazily-loaded route screens — a calm skeleton shown
// while a page chunk loads. Shared by the desktop shell (App) and the mobile
// shell (MobileApp). The skeleton is decorative (aria-hidden); a polite live
// region announces the load so screen-reader users get feedback too.
export default function PageFallback() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <span className="sr-only" role="status">טוען…</span>
      <div aria-hidden="true">
        <div className="skeleton" style={{ height: 34, width: 260, borderRadius: 9, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 16, width: 380, borderRadius: 7, marginBottom: 26 }} />
        <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
      </div>
    </div>
  );
}
