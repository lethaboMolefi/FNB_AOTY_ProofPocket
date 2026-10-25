// The app's tones (good, warn, bad, info, plain) as shadcn Badges, for screens moving off the old Pill.
import type { Tone } from "@proofpocket/shared";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VARIANT = { good: "success", warn: "warning", bad: "destructive", info: "default", plain: "secondary" } as const;

export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <Badge variant={VARIANT[tone]} className={cn("whitespace-nowrap", tone === "info" && "bg-accent-soft text-accent", className)}>{children}</Badge>;
}

export const LevelBadge = ({ verified }: { verified: boolean }) =>
  verified ? <ToneBadge tone="good">Verified</ToneBadge> : <ToneBadge tone="warn">Starter</ToneBadge>;
