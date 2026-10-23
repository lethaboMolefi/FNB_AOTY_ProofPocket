// Phone "More" tab: every founder section not on the bottom tab bar, in the rail's groups.
import { Link } from "react-router-dom";
import { FOUNDER_TABS, founderNavFor } from "../../app/nav";
import { PageHead } from "../../components/ui";
import { useMe } from "../../lib/me";

const onTabs = new Set<string>(FOUNDER_TABS.map((t) => t.path));

export default function More() {
  const { data: me } = useMe();
  const groups = founderNavFor(me?.company?.businessType)
    .map((g) => ({ ...g, pages: g.pages.filter((p) => !onTabs.has(p.path)) }))
    .filter((g) => g.pages.length);
  return (
    <>
      <PageHead title="More" />
      {groups.map((g) => (
        <section key={g.group} className="panel">
          <h2 className="label !mb-2">{g.group}</h2>
          <div className="flex flex-col">
            {g.pages.map((p) => (
              <Link key={p.path} to={`/app/${p.path}`} className="li items-center text-ink no-underline" style={{ minHeight: 44 }}>
                <span className="font-semibold">{p.label}</span>
                <span aria-hidden="true" className="muted">›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <p className="hint">ProofPocket never holds money.</p>
    </>
  );
}
