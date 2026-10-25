// The hosted demo holds example data only (VITE_DEMO=yes at build time). Says so on every page.
export function DemoBanner() {
  if (import.meta.env.VITE_DEMO !== "yes") return null;
  return (
    <div role="note" className="border-b border-line bg-warn-soft px-4 py-1.5 text-center small">
      <b>Demo with example data.</b> Don't upload real ID documents or enter real bank details. <a href="/privacy-notice">Privacy notice</a>
    </div>
  );
}
