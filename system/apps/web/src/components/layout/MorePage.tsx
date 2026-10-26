// Phone "More": every page that isn't on the bottom tab bar, grouped as in the sidebar. Same for every role.
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { navIcon } from "../../app/nav-icons";
import { useCounts } from "../../lib/counts";
import { PageHeader } from "../PageHeader";
import type { ShellGroup } from "./AppShell";

export function MorePage({ base, groups, tabs, sub }: { base: string; groups: ShellGroup[]; tabs: string[]; sub?: string }) {
  const counts = useCounts();
  const rest = groups.map((g) => ({ ...g, pages: g.pages.filter((p) => !tabs.includes(p.path)) })).filter((g) => g.pages.length);
  return (
    <>
      <PageHeader title="More" sub={sub} />
      <div className="space-y-4">
        {rest.map((g) => (
          <Card key={g.group || "pages"}>
            {g.group && (
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g.group}</CardTitle>
              </CardHeader>
            )}
            <CardContent className={g.group ? "p-0 pb-1" : "p-0 py-1"}>
              {g.pages.map((p, i) => {
                const Icon = navIcon(p.path);
                return (
                  <div key={p.path}>
                    {i > 0 && <Separator />}
                    <Link to={`${base}/${p.path}`} className="flex min-h-12 items-center gap-3 rounded-md px-4 py-3 text-foreground no-underline transition-colors hover:bg-surface-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                      <span className="flex-1 text-sm font-medium">{p.label}</span>
                      {counts[p.path] ? <span className="count" aria-label={`${counts[p.path]} waiting`}>{counts[p.path]}</span> : null}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
