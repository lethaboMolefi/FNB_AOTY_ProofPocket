// Founder layout: grouped left rail on desktop; bottom tab bar (Home, Books, Get paid, Markets, More) on phones.
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { TwoFactorPrompt } from "../../features/auth/TwoFactor";
import { FOUNDER_TABS, founderNavFor } from "../../app/nav";
import { useCounts } from "../../lib/counts";
import { useMe } from "../../lib/me";
import { InstallHint } from "../../lib/pwa";
import { Icon } from "../icons";
import { TopBar } from "./TopBar";

export function FounderShell() {
  const { data: me } = useMe();
  const nav = founderNavFor(me?.company?.businessType);
  const onHome = useLocation().pathname === "/app/home";
  const counts = useCounts();
  return (
    <>
      <TopBar home="/app" who={me?.company && <span className="hidden desktop:inline muted">{me.company.name}</span>} />
      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 pb-[calc(var(--tabbar-h)+32px+env(safe-area-inset-bottom,0px))] pt-5 desktop:grid-cols-[220px_minmax(0,1fr)] desktop:pb-12">
        <nav className="sticky top-[76px] hidden flex-col gap-0.5 self-start desktop:flex" aria-label="Sections">
          <div className="label mx-2.5 mb-2 mt-1">Your business</div>
          {nav.map((g) => (
            <div key={g.group || "top"}>
              {g.group && <div className="rail-group">{g.group}</div>}
              {g.pages.map((p) => (
                <NavLink key={p.path} to={`/app/${p.path}`} className="rail-link"><span>{p.label}</span>{counts[p.path] ? <span className="count" aria-label={`${counts[p.path]} waiting`}>{counts[p.path]}</span> : null}</NavLink>
              ))}
            </div>
          ))}
          <p className="hint mt-4 border-t border-line px-2.5 pt-3">ProofPocket never holds money.</p>
        </nav>
        <main id="main" className="flex min-w-0 flex-col gap-5" tabIndex={-1}>
          {onHome && <TwoFactorPrompt />}
          <InstallHint />
          <Outlet />
        </main>
      </div>
      <nav className="tabbar desktop:hidden" aria-label="Main">
        {FOUNDER_TABS.map((t) => (
          <NavLink key={t.path} to={`/app/${t.path}`} className="tab">
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
