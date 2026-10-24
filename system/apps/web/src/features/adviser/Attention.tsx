// Needs attention (v2/app.js ngoAttention): flags across the cohort, most urgent first.
import { type Flag } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHead, Pill, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { AdviserDrawer } from "./AdviserDrawer";

export default function Attention() {
  const q = useQuery({ queryKey: ["adviser", "attention"], queryFn: () => api<{ incubator: string; items: (Flag & { companyId: string; company: string })[] }>("/adviser/attention") });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <><PageHead title="Needs attention" /><Spinner /></>;
  return (
    <>
      <PageHead label={q.data.incubator} title="Needs attention" sub="Problems spotted in your companies' books, documents, stock and messages, most urgent first." />
      <section className="panel">
        {q.data.items.length ? q.data.items.map((f, i) => (
          <div key={i} className="li">
            <div className="li-main"><span><Pill tone={f.level}>{f.level === "bad" ? "Act now" : "Check"}</Pill> <b>{f.company}</b></span><span className="small">{f.text}</span></div>
            <div className="li-side"><button className="btn sm" onClick={() => setOpen(f.companyId)}>Open</button></div>
          </div>
        )) : <p className="muted">Nothing needs attention.</p>}
      </section>
      {open && <AdviserDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
