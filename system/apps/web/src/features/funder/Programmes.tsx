// Programmes & requirements (v2/app.js funderProgrammes).
import { DOCS, FUNDER_REQUIRABLE_DOCS, R, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHead, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { ProgrammeForm } from "./ProgrammeForm";

interface Prog { id: string; name: string; status: "open" | "closed"; min: number; max: number; budget: number; committed: number; left: number; minMonths: number; minScore: number; requiredDocs: DocType[]; qualify: number }

export default function Programmes() {
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ["funder", "programmes"], queryFn: () => api<{ funder: { name: string; kind: string | null }; programmes: Prog[] }>("/funder/programmes") });
  if (!q.data) return <><PageHead title="Programmes & requirements" /><Spinner /></>;
  const call = async (path: string, body: object) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["funder"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <PageHead label={q.data.funder.name} title="Programmes & requirements" sub="Founders see these requirements before they apply. Changes reach them straight away."
        side={!adding && <button className="btn" onClick={() => setAdding(true)}>Add a programme</button>} />
      {adding && <ProgrammeForm onDone={() => { setAdding(false); void qc.invalidateQueries({ queryKey: ["funder"] }); }} onCancel={() => setAdding(false)} />}
      {q.data.programmes.map((p) => (
        <section key={p.id} className="panel stack">
          <div className="panel-head" style={{ margin: 0 }}>
            <div><h2>{p.name} {p.status === "closed" && <Pill tone="plain">Closed</Pill>}</h2>
              <span className="hint">{q.data.funder.kind} · {R(p.min)} to {R(p.max)} per business · {p.minMonths} months of records · score {p.minScore}+</span></div>
            <div className="row" style={{ gap: 6 }}><Pill tone="info">{p.qualify} verified {p.qualify === 1 ? "company qualifies" : "companies qualify"}</Pill>
              <button className="btn sm ghost" onClick={() => void call(`/funder/programmes/${p.id}/status`, { status: p.status === "open" ? "closed" : "open" })}>{p.status === "open" ? "Close to applications" : "Reopen"}</button></div>
          </div>
          <div className="grid-3">
            <div className="stat"><span className="label">Budget</span><span className="v">{R(p.budget)}</span></div>
            <div className="stat"><span className="label">Committed</span><span className="v">{R(p.committed)}</span></div>
            <div className="stat"><span className="label">Left</span><span className="v">{R(p.left)}</span><div className="bar" style={{ width: "100%" }}><i style={{ width: `${Math.min(100, Math.round((p.committed / (p.budget || 1)) * 100))}%` }} /></div></div>
          </div>
          <div><div className="label mb-1.5">Required documents (click to change)</div>
            <div className="row" style={{ gap: 6 }}>{FUNDER_REQUIRABLE_DOCS.map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={p.requiredDocs.includes(k)} onClick={() => void call(`/funder/programmes/${p.id}/requirements`, { docType: k })}>{DOCS[k].name}</button>
            ))}</div></div>
        </section>
      ))}
    </>
  );
}
