// The one page header, for every role and every page: the H1 title, a one-line description, and optional
// page actions on the right. Deliberately nothing else: the business or organisation name and the
// Starter/Verified badge live only in the top bar, so they can't be repeated here.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  sub?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, sub, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {sub && <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
