// A boxed message in the shadcn style: info, warning, problem or good news, with an optional action on the right.
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  info: { box: "border-line bg-surface-2", icon: Info, iconClass: "text-accent" },
  warn: { box: "border-warn/30 bg-warn-soft", icon: AlertTriangle, iconClass: "text-warn" },
  bad: { box: "border-bad/30 bg-bad-soft", icon: AlertCircle, iconClass: "text-bad" },
  good: { box: "border-good/30 bg-good-soft", icon: CheckCircle2, iconClass: "text-good" },
} as const;

export function Callout({ tone, children, action, className, role }: { tone: keyof typeof TONES; children: ReactNode; action?: ReactNode; className?: string; role?: "alert" | "status" }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm text-foreground", t.box, className)} role={role}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {action}
    </div>
  );
}
