// Founder layout: grouped left rail on desktop; bottom tab bar on phones.
import { cn } from "@/lib/utils";
import {
  BarChart3, BookOpen, Building, CreditCard, Eye,
  FileCheck, Home, Package, Settings, ShieldCheck, Store, TrendingUp,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { TwoFactorPrompt } from "../../features/auth/TwoFactor";
import { PrivacyNoticePrompt } from "../../features/founder/PrivacyNoticePrompt";
import { FOUNDER_TABS, founderNavFor } from "../../app/nav";
import { useCounts } from "../../lib/counts";
import { useMe } from "../../lib/me";
import { InstallHint } from "../../lib/pwa";
import { Icon } from "../icons";
import { TopBar } from "./TopBar";
import { Badge } from "../ui/badge";

// Maps path → lucide icon component
const PATH_ICON: Record<string, React.ElementType> = {
  home:        Home,
  books:       BookOpen,
  stock:       Package,
  payments:    CreditCard,
  cashflow:    BarChart3,
  markets:     Store,
  funding:     TrendingUp,
  procurement: Building,
  protection:  ShieldCheck,
  privacy:     Eye,
  start:       FileCheck,
  settings:    Settings,
};

function SidebarLink({ path, label, count }: { path: string; label: string; count?: number }) {
  const IconComp = PATH_ICON[path] ?? Home;
  return (
    <NavLink
      to={`/app/${path}`}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100",
          isActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <IconComp className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
          <span className="flex-1 truncate">{label}</span>
          {count ? <span className="count" aria-label={`${count} waiting`}>{count}</span> : null}
        </>
      )}
    </NavLink>
  );
}

export function FounderShell() {
  const { data: me } = useMe();
  const nav = founderNavFor(me?.company?.businessType);
  const pathname = useLocation().pathname;
  const onHome = pathname === "/app/home" || pathname === "/app";
  const counts = useCounts();

  return (
    <>
      <TopBar
        home="/app"
        who={
          me?.company && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">
                {me.company.name}
              </span>
              {me.company.verified
                ? <Badge variant="success" className="text-[10px] shrink-0">Verified</Badge>
                : <Badge variant="secondary" className="text-[10px] shrink-0">Starter</Badge>
              }
            </div>
          )
        }
      />

      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 pb-[calc(var(--tabbar-h)+32px+env(safe-area-inset-bottom,0px))] pt-6 desktop:grid-cols-[216px_minmax(0,1fr)] desktop:pb-12">

        {/* ── Desktop sidebar ── */}
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px-24px)] flex-col self-start overflow-y-auto desktop:flex">
          <nav className="flex flex-col gap-0.5 pr-2" aria-label="Sections">

            {nav.map((g) => (
              <div key={g.group || "top"} className={g.group ? "mt-4 first:mt-0" : ""}>
                {g.group && (
                  <p className="select-none px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {g.group}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {g.pages.map((p) => <SidebarLink key={p.path} path={p.path} label={p.label} count={counts[p.path]} />)}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="mt-auto pt-4 pb-2 pr-2">
            <div className="rounded-lg bg-surface-2 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ProofPocket never holds or moves money. Clients pay you directly.
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main id="main" className="flex min-w-0 flex-col gap-6" tabIndex={-1}>
          <PrivacyNoticePrompt />
          {onHome && <TwoFactorPrompt />}
          <InstallHint />
          <Outlet />
        </main>
      </div>

      {/* ── Phone bottom tab bar ── */}
      <nav className="tabbar desktop:hidden" aria-label="Main navigation">
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
