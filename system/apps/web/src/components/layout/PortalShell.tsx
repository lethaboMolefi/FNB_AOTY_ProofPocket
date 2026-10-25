// Funder, adviser and admin layout: desktop-first left rail that becomes a scrolling strip on phones.
import {
  Activity, ClipboardCheck, FileCheck, HeartPulse, LayoutDashboard, Flag, Gavel, Inbox, LayoutGrid, LifeBuoy, ListChecks, type LucideIcon, Megaphone, ShieldAlert, SlidersHorizontal, Users, Building2, Workflow,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { NavPage } from "../../app/nav";
import { useCounts } from "../../lib/counts";
import { useMe } from "../../lib/me";
import { TopBar } from "./TopBar";

// Icon per page path, in the same style as the founder sidebar.
const PATH_ICON: Record<string, LucideIcon> = {
  pipeline: Workflow, applications: Inbox, programmes: ListChecks, setup: SlidersHorizontal,
  cohort: LayoutGrid, checks: FileCheck, attention: ShieldAlert, support: LifeBuoy,
  overview: LayoutDashboard, activity: Activity, people: Users, health: HeartPulse,
  organisations: Building2, reports: Flag, features: Megaphone, flagged: ClipboardCheck, tenders: Gavel,
};

export function PortalShell({ base, title, pages }: { base: string; title: string; pages: NavPage[] }) {
  const { data: me } = useMe();
  const counts = useCounts();
  return (
    <>
      <TopBar home={base} who={me && <span className="max-w-[180px] truncate text-sm font-medium text-foreground">{me.org?.name ?? me.displayName}</span>} />
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-12 pt-5 desktop:grid-cols-[240px_minmax(0,1fr)] desktop:gap-6">
        <nav className="flex gap-1 overflow-x-auto pb-1 desktop:sticky desktop:top-[76px] desktop:flex-col desktop:gap-0.5 desktop:self-start desktop:overflow-visible" aria-label="Sections">
          <p className="mb-1 hidden select-none px-3 pt-0.5 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground desktop:block">{title}</p>
          {pages.map((p) => {
            const Icon = PATH_ICON[p.path] ?? Users;
            const count = counts[p.path];
            return (
              <NavLink key={p.path} to={`${base}/${p.path}`}
                className={({ isActive }) => cn("group flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100 desktop:min-h-0",
                  isActive ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground")}>
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} aria-hidden="true" />
                    <span className="flex-1 truncate">{p.label}</span>
                    {count ? <span className="count" aria-label={`${count} waiting`}>{count}</span> : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <main id="main" className="flex min-w-0 flex-col gap-5" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
