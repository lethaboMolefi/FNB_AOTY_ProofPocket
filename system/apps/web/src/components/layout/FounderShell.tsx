// Founder layout: grouped left rail on desktop; bottom tab bar on phones.
import { cn } from "@/lib/utils";
import {
  BarChart3, BookOpen, Building, CreditCard, Eye,
  FileCheck, Home, Package, Settings, ShieldCheck, Store, TrendingUp,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FOUNDER_TABS, founderNavFor } from "../../app/nav";
import { useMe } from "../../lib/me";
import { InstallHint } from "../../lib/pwa";
import { api } from "../../lib/api";
import { Icon } from "../icons";
import { TopBar } from "./TopBar";
import { Badge } from "../ui/badge";
import { NotificationPanel, type Notification } from "../NotificationPanel";

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

// Sidebar navigation structure
const SIDEBAR_GROUPS = [
  { label: null,                      paths: ["home"] },
  { label: "Daily operations",        paths: ["books", "stock", "payments", "cashflow"] },
  { label: "Documents",               paths: ["start"] },
  { label: "Funding & markets",       paths: ["markets", "funding", "procurement"] },
  { label: "Safety",                  paths: ["protection", "privacy"] },
  { label: "Account",                 paths: ["settings"] },
];

function SidebarLink({ path, label }: { path: string; label: string }) {
  const IconComp = PATH_ICON[path] ?? Home;
  return (
    <NavLink
      to={`/app/${path}`}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100",
          isActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <IconComp className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
          <span className="flex-1 truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function FounderShell() {
  const { data: me } = useMe();
  const nav = founderNavFor(me?.company?.businessType);
  const pathname = useLocation().pathname;

  const pageByPath = Object.fromEntries(
    nav.flatMap((g) => g.pages.map((p) => [p.path, p]))
  );

  // Fetch home notices to power the notification bell
  const notices = useQuery({
    queryKey: ["founder", "home-notices"],
    queryFn: () => api<{ notices: { starter: boolean; proofsToCheck: number; fraudOpen: number } }>("/founder/home"),
    enabled: me?.role === "founder",
    staleTime: 30_000,
    select: (d) => d.notices,
  });

  const n = notices.data;

  // Build all notifications — urgent first, then informational
  const notifications: Notification[] = [];

  if (n?.fraudOpen && n.fraudOpen > 0) {
    notifications.push({
      id: "fraud",
      tone: "bad",
      title: `${n.fraudOpen} possible scam${n.fraudOpen !== 1 ? "s" : ""} flagged`,
      body: "Check before paying anyone. Open Protection to review the flagged transactions.",
      href: "/app/protection",
      hrefLabel: "Review now",
      persistent: true,
    });
  }

  if (n?.proofsToCheck && n.proofsToCheck > 0) {
    notifications.push({
      id: "proofs",
      tone: "warn",
      title: `${n.proofsToCheck} client${n.proofsToCheck !== 1 ? "s" : ""} ${n.proofsToCheck === 1 ? "says they've" : "say they've"} paid`,
      body: "Confirm in your banking app before marking as paid — never trust a screenshot alone.",
      href: "/app/payments",
      hrefLabel: "Check payments",
      persistent: true,
    });
  }

  if (me?.role === "founder" && !me.twoFactor?.enabled) {
    notifications.push({
      id: "two-factor",
      tone: "warn",
      title: "Protect your account with Google Authenticator",
      body: "With two-step sign-in, a stolen password can't be used to get in or change where clients pay you.",
      href: "/app/settings",
      hrefLabel: "Set up",
    });
  }

  if (me?.company && !me.company.verified) {
    notifications.push({
      id: "starter-verified",
      title: "Get your Verified badge",
      body: "Finish registration to get Verified — funders and buyers look for the badge before they work with a business.",
      href: "/app/start",
      hrefLabel: "Continue registration",
    });
  }

  notifications.push({
    id: "sars-turnover-tax",
    title: "Good news about SARS and tax",
    body: "Under SARS Turnover Tax, micro-businesses pay R0 on their first R335,000 in annual turnover. A salon doing R5,000–R20,000 a month owes nothing in tax. Being registered with SARS unlocks funding you cannot get without it.",
    href: "https://www.sars.gov.za/types-of-tax/turnover-tax/",
    hrefLabel: "Read more on the SARS website",
    external: true,
  });

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
        right={<NotificationPanel notifications={notifications} />}
      />

      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pb-[calc(var(--tabbar-h)+32px+env(safe-area-inset-bottom,0px))] pt-6 desktop:grid-cols-[240px_minmax(0,1fr)] desktop:pb-12">

        {/* ── Desktop sidebar ── */}
        <aside className="sticky top-[56px] hidden h-[calc(100vh-56px-24px)] flex-col self-start overflow-y-auto desktop:flex">
          <nav className="flex flex-col gap-0.5 pr-2" aria-label="Navigation">

            {SIDEBAR_GROUPS.map(({ label, paths }) => {
              const pages = paths
                .map((p) => pageByPath[p])
                .filter((p): p is NonNullable<typeof p> => p != null);
              if (!pages.length) return null;

              return (
                <div key={label ?? "top"} className={label ? "mt-4 first:mt-0" : ""}>
                  {label && (
                    <p className="px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                      {label}
                    </p>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {pages.map((p) => (
                      <SidebarLink key={p.path} path={p.path} label={p.label} />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="mt-auto pt-4 pb-2 pr-2">
            <div className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ProofPocket never holds or moves money. Clients pay you directly.
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main id="main" className="flex min-w-0 flex-col gap-6" tabIndex={-1}>
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
