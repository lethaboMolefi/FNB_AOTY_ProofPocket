// One row of a dashboard list: details on the left, status or actions on the right (stacked on phones).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ListRow({ children, side, className }: { children: ReactNode; side?: ReactNode; className?: string }) {
  return (
    <li className={cn("flex flex-col gap-3 border-b border-border py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 flex-1 space-y-1 text-sm">{children}</div>
      {side && <div className="flex shrink-0 flex-wrap items-center gap-2">{side}</div>}
    </li>
  );
}

/** Secondary line under a row's title. */
export const RowHint = ({ children }: { children: ReactNode }) => <p className="text-xs text-muted-foreground">{children}</p>;
