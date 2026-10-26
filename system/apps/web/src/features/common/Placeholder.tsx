// Stands in for a screen until its build phase. Shows the real page head so navigation can be checked now.
import { Link } from "react-router-dom";
import type { NavPage } from "../../app/nav";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../../components/PageHeader";
import { Callout } from "@/components/ui/callout";
import { LevelBadge } from "../../components/ToneBadge";
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
      <PageHeader
        label={c ? `${c.name} · ${c.town}, ${c.province}` : me?.org?.name}
        title={page.title}
        sub={page.sub}
        badge={c && <LevelBadge verified={c.verified} />}
      />
      <Callout tone="info"><b>Being built.</b> This screen arrives in phase {page.phase}: {PHASES[page.phase]}.</Callout>
    </>
  );
}

export function NotFound() {
  return (
    <main id="main" className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16">
      <PageHeader title="Page not found" sub="The link may be old or mistyped." />
      <Button asChild className="self-start"><Link to="/">Go to ProofPocket</Link></Button>
    </main>
  );
}
