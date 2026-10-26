// Needs attention (v2/app.js ngoAttention): flags across the cohort, most urgent first.
import { type Flag } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { PanelRightOpen, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../../components/EmptyState";
import { ListRow } from "../../components/ListRow";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { AdviserDrawer } from "./AdviserDrawer";

const SUB = "Problems spotted in your companies' books, documents, stock and messages, most urgent first.";

export default function Attention() {
  const q = useQuery({ queryKey: ["adviser", "attention"], queryFn: () => api<{ incubator: string; items: (Flag & { companyId: string; company: string })[] }>("/adviser/attention") });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <><PageHeader title="Needs attention" sub={SUB} /><Spinner /></>;
  return (
    <>
      <PageHeader title="Needs attention" sub={SUB} />
      <Card><CardContent className="pt-2">
        {q.data.items.length ? <ul>{q.data.items.map((f, i) => (
          <ListRow key={i} side={<Button size="sm" variant="outline" onClick={() => setOpen(f.companyId)}><PanelRightOpen className="h-4 w-4" />Open</Button>}>
            <p className="flex flex-wrap items-center gap-2"><ToneBadge tone={f.level}>{f.level === "bad" ? "Act now" : "Check"}</ToneBadge><b>{f.company}</b></p>
            <p>{f.text}</p>
          </ListRow>
        ))}</ul> : <EmptyState icon={ShieldCheck}>Nothing needs attention.</EmptyState>}
      </CardContent></Card>
      {open && <AdviserDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
