// Funder, adviser and admin layout: the shared AppShell with the portal's pages and the organisation's name.
import type { NavPage } from "../../app/nav";
import { useMe } from "../../lib/me";
import { AppShell } from "./AppShell";

export function PortalShell({ base, title, pages, tabs, note }: { base: string; title: string; pages: NavPage[]; tabs: string[]; note: string }) {
  const { data: me } = useMe();
  return (
    <AppShell
      base={base}
      groups={[{ group: title, pages }]}
      tabs={tabs}
      who={me && <span className="min-w-0 max-w-[180px] truncate text-sm font-semibold text-foreground">{me.org?.name ?? me.displayName}</span>}
      note={note}
    />
  );
}
