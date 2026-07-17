/**
 * Shown for the brief moment a lazily-loaded page's code is downloading. It sits inside
 * the layout, so the sidebar and top bar stay put — only the content area shows this. A
 * small centered spinner, nothing heavy, because it is on screen for a fraction of a
 * second and only the first time a section is opened.
 */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <span className="border-line border-t-brand-600 h-6 w-6 animate-spin rounded-full border-2" />
    </div>
  );
}
