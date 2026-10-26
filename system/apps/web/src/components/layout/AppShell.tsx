// The layout every role uses: top bar, grouped sidebar with icons on desktop, bottom tab bar on phones.
// Roles differ only in what they put in it (pages, the name in the top bar, prompts above the page).
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useCounts } from "../../lib/counts";
import { NavItem, TabItem } from "./NavItem";
import { TopBar } from "./TopBar";

export interface ShellPage { path: string; label: string; short?: string }
export interface ShellGroup { group: string; pages: ShellPage[] }

/** Up to four pages as phone tabs; the rest go under More. */
export const MAX_TABS = 4;

export function AppShell({ base, groups, tabs, who, right, note, before }: {
  base: string;
  groups: ShellGroup[];
  /** Paths for the phone tab bar, in order (More is added when other pages remain). */
  tabs: string[];
  who?: ReactNode;
  right?: ReactNode;
  /** A short line at the foot of the sidebar. */
  note?: ReactNode;
  /** Prompts shown above every page (e.g. two-step sign-in, privacy notice). */
  before?: ReactNode;
}) {
  const counts = useCounts();
  const all = groups.flatMap((g) => g.pages);
  const tabPages = tabs.map((t) => all.find((p) => p.path === t)).filter((p): p is ShellPage => !!p);
  const more = all.length > tabPages.length;
  const columns = tabPages.length + (more ? 1 : 0);
  return (
    <>
      <TopBar home={base} who={who} right={right} />
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-[calc(var(--tabbar-h)+32px+env(safe-area-inset-bottom,0px))] pt-6 desktop:grid-cols-[240px_minmax(0,1fr)] desktop:pb-12">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px-24px)] flex-col self-start overflow-y-auto desktop:flex">
          <nav className="flex flex-col gap-0.5 pr-2" aria-label="Sections">
            {groups.map((g) => (
              <div key={g.group || "top"} className={g.group ? "mt-4 first:mt-0" : ""}>
                {g.group && <p className="select-none px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">{g.group}</p>}
                <div className="flex flex-col gap-0.5">
                  {g.pages.map((p) => <NavItem key={p.path} to={`${base}/${p.path}`} path={p.path} label={p.label} count={counts[p.path]} />)}
                </div>
              </div>
            ))}
          </nav>
          {note && <div className="mt-auto pb-2 pr-2 pt-4"><div className="rounded-lg bg-surface-2 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">{note}</div></div>}
        </aside>
        <main id="main" className="flex min-w-0 flex-col gap-6" tabIndex={-1}>
          {before}
          <Outlet />
        </main>
      </div>
      <nav className="tabbar desktop:hidden" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-label="Main navigation">
        {tabPages.map((p) => <TabItem key={p.path} to={`${base}/${p.path}`} path={p.path} label={p.short ?? p.label} count={counts[p.path]} />)}
        {more && <TabItem to={`${base}/more`} path="more" label="More" />}
      </nav>
    </>
  );
}
