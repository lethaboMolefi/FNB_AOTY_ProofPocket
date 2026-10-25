// A figure with its label and icon, in the same style as Home's metric cards (founder Home keeps its own copy).
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, sub, icon: Icon, valueClass, children }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: LucideIcon; valueClass?: string; children?: ReactNode;
}) {
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardContent className="pb-4 pt-4">
        <div className="mb-2 flex items-start justify-between">
          <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        </div>
        <p className={cn("text-2xl font-bold tabular-nums tracking-tight", valueClass ?? "text-foreground")}>{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {children}
      </CardContent>
    </Card>
  );
}
