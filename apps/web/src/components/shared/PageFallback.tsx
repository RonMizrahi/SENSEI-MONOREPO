// Suspense fallback for lazily-loaded route screens — a calm skeleton shown
// while a page chunk loads. Shared by the desktop shell (App) and the mobile
// shell (MobileApp).
export default function PageFallback() {
  return (
    <div aria-hidden="true" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="skeleton" style={{ height: 34, width: 260, borderRadius: 9, marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 16, width: 380, borderRadius: 7, marginBottom: 26 }} />
      <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
    </div>
  );
}
