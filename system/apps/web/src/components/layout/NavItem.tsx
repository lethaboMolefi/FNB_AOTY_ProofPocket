// The one navigation link style, used by every role: sidebar rows on desktop, bottom tabs on phones.
import { createElement } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navIcon } from "../../app/nav-icons";

export function NavItem({ to, path, label, count }: { to: string; path: string; label: string; count?: number }) {
  const Icon = navIcon(path);
  return (
    <NavLink to={to}
      className={({ isActive }) => cn("group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100",
        isActive ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground")}>
      {({ isActive }) => (
        <>
          <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} aria-hidden="true" />
          <span className="flex-1 truncate">{label}</span>
          {count ? <span className="count" aria-label={`${count} waiting`}>{count}</span> : null}
        </>
      )}
    </NavLink>
  );
}

export function TabItem({ to, path, label, count }: { to: string; path: string; label: string; count?: number }) {
  return (
    <NavLink to={to} className="tab relative">
      {createElement(navIcon(path), { "aria-hidden": true })}
      <span>{label}</span>
      {count ? <span className="count absolute right-[calc(50%-22px)] top-1.5" aria-label={`${count} waiting`}>{count}</span> : null}
    </NavLink>
  );
}
