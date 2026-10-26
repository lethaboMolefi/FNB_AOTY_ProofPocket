// The demo site (VITE_DEMO=yes at build time): example data on its own server, separate from live ProofPocket.
export function DemoBanner() {
  if (import.meta.env.VITE_DEMO !== "yes") return null;
  return (
    <div role="note" className="border-b border-line bg-warn-soft px-4 py-1.5 text-center small">
      <b>Demo site: example data only.</b> Nothing here reaches the live ProofPocket, and no emails are sent. Don't upload real ID documents or enter real bank details.
    </div>
  );
}
