// Page header for founder screens. Shows title, optional subtitle, and Starter/Verified badge.
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "../../components/PageHeader";
import { useMe } from "../../lib/me";
import type { ReactNode } from "react";

interface FounderHeadProps {
  title: string;
  sub?: string;
  action?: ReactNode;
}

export function FounderHead({ title, sub, action }: FounderHeadProps) {
  const c = useMe().data?.company;
  const badge = c ? (
    c.verified
      ? (
        <Badge variant="success" className="gap-1 text-xs">
          <BadgeCheck className="h-3 w-3" />Verified
        </Badge>
      )
      : (
        <Badge variant="secondary" className="text-xs">Starter</Badge>
      )
  ) : undefined;

  return <PageHeader title={title} sub={sub} badge={badge} action={action} />;
}
