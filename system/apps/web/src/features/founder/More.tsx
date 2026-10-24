// Phone "More" tab — all founder sections not on the bottom tab bar, grouped by category.
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { FOUNDER_TABS, founderNavFor } from "../../app/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMe } from "../../lib/me";

const onTabs = new Set<string>(FOUNDER_TABS.map((t) => t.path));

export default function More() {
  const { data: me } = useMe();
  const groups = founderNavFor(me?.company?.businessType)
    .map((g) => ({ ...g, pages: g.pages.filter((p) => !onTabs.has(p.path)) }))
    .filter((g) => g.pages.length);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground mt-1">ProofPocket never holds money.</p>
      </div>

      <div className="space-y-4">
        {groups.map((g, gi) => (
          <Card key={g.group}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {g.group}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-1">
              {g.pages.map((p, i) => (
                <div key={p.path}>
                  {i > 0 && <Separator />}
                  <Link
                    to={`/app/${p.path}`}
                    className="flex items-center justify-between px-4 py-3 text-foreground no-underline hover:bg-muted/50 transition-colors rounded-md"
                    style={{ minHeight: 48 }}
                  >
                    <span className="text-sm font-medium">{p.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
