// Page header for founder screens: the shared PageHeader. The business name and Starter/Verified badge
// are in the top bar, not here.
import type { ReactNode } from "react";
import { PageHeader } from "../../components/PageHeader";

export function FounderHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <PageHeader title={title} sub={sub} action={action} />;
}
