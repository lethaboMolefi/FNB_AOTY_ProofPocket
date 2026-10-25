// Funder, adviser and admin layout: desktop left rail, mobile horizontal scroll strip.
import { cn } from "@/lib/utils";
import { NavLink, Outlet } from "react-router-dom";
import type { NavPage } from "../../app/nav";
import { useMe } from "../../lib/me";
import { TopBar } from "./TopBar";

export function PortalShell({ base, title, pages }: { base: string; title: string; pages: NavPage[] }) {
  const { data: me } = useMe();
  return (
    <>
      <TopBar
        home={base}
        who={
          me && (
            <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
              {me.org?.name ?? me.displayName}
            </span>
          )
        }
      />

      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 pb-16 pt-5
        desktop:grid-cols-[240px_minmax(0,1fr)] desktop:gap-8">

        {/* ── Sidebar / horizontal strip ── */}
        <nav
          className="flex gap-1 overflow-x-auto pb-1 desktop:sticky desktop:top-[76px]
            desktop:flex-col desktop:gap-0.5 desktop:self-start desktop:overflow-visible
            desktop:pb-0 desktop:pr-1"
          aria-label="Sections"
        >
          {/* Portal title — desktop only */}
          <p className="hidden desktop:block text-[11px] font-semibold uppercase tracking-wider
            text-muted-foreground px-3 pt-1 pb-2">
            {title}
          </p>

          {pages.map((p) => (
            <NavLink
              key={p.path}
              to={`${base}/${p.path}`}
              className={({ isActive }) =>
                cn(
                  "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                  "transition-colors duration-100",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {p.label}
            </NavLink>
          ))}
        </nav>

        {/* ── Page content ── */}
        <main id="main" className="flex min-w-0 flex-col gap-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
