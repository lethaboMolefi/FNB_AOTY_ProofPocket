// Stands in for a screen until its build phase. Shows the real page head so navigation can be checked now.
import { Link } from "react-router-dom";
import type { NavPage } from "../../app/nav";
import { LevelPill, Notice, PageHead } from "../../components/ui";
import { useMe } from "../../lib/me";

const PHASES: Record<number, string> = {
  2: "Join and Start",
  3: "Trade and cash flow",
  4: "Get paid and stay safe",
  5: "Formal markets and the other portals",
};

export function Placeholder({ page }: { page: NavPage }) {
  const { data: me } = useMe();
  const c = me?.company;
  return (
    <>
      <PageHead
        label={c ? `${c.name} · ${c.town}, ${c.province}` : me?.org?.name}
        title={page.title}
        sub={page.sub}
        side={c && <LevelPill verified={c.verified} />}
      />
      <Notice tone="info" icon="i">
        <span className="small"><b>Being built.</b> This screen arrives in phase {page.phase}: {PHASES[page.phase]}.</span>
      </Notice>
    </>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 px-4 py-16">
      <h1>Page not found</h1>
      <p className="muted">The link may be old or mistyped.</p>
      <Link className="btn primary self-start" to="/">Go to ProofPocket</Link>
    </div>
  );
}
