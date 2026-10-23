// Funder, adviser and admin layout: desktop-first left rail that becomes a scrolling strip on phones.
import { NavLink, Outlet } from "react-router-dom";
import type { NavPage } from "../../app/nav";
import { useMe } from "../../lib/me";
import { TopBar } from "./TopBar";

export function PortalShell({ base, title, pages }: { base: string; title: string; pages: NavPage[] }) {
  const { data: me } = useMe();
  return (
    <>
      <TopBar home={base} who={me && <span className="muted">{me.org?.name ?? me.displayName}</span>} />
      <div className="mx-auto grid max-w-[1280px] gap-4 px-4 pb-12 pt-5 desktop:grid-cols-[220px_minmax(0,1fr)] desktop:gap-6">
        <nav className="flex gap-1 overflow-x-auto pb-1 desktop:sticky desktop:top-[76px] desktop:flex-col desktop:gap-0.5 desktop:self-start desktop:overflow-visible" aria-label="Sections">
          <div className="label mx-2.5 mb-2 mt-1 hidden desktop:block">{title}</div>
          {pages.map((p) => (
            <NavLink key={p.path} to={`${base}/${p.path}`} className="rail-link shrink-0 whitespace-nowrap">{p.label}</NavLink>
          ))}
        </nav>
        <main id="main" className="flex min-w-0 flex-col gap-5" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
