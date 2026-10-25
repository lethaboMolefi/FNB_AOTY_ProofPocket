// Shared page header for all founder screens.
// Replaces the old FounderHead + PageHead pattern.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  sub?: string;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, sub, badge, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {sub && (
          <p className="text-sm text-muted-foreground mt-1 max-w-[60ch] leading-relaxed">{sub}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
