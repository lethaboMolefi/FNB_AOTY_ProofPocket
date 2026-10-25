// Cohort board (v2/app.js ngoCohort), plus requests to join (inventory 12.12).
import { type Flag } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ScoreCell } from "../../components/charts";
import { LevelPill, PageHead, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { AdviserDrawer } from "./AdviserDrawer";

interface Data {
  incubator: string; stages: string[];
  tiles: { companies: number; starters: number; avgReadiness: number; toCheck: number; sessions: number };
  companies: { id: string; name: string; sector: string; town: string; stage: number; verified: boolean; adviser: string | null; score: number; flags: Flag[] }[];
  requests: { id: string; name: string; sector: string; town: string }[];
}

export default function Cohort() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["adviser", "cohort"], queryFn: () => api<Data>("/adviser/cohort") });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <><PageHead title="Cohort board" /><Spinner /></>;
  const d = q.data;
  const decide = async (id: string, accept: boolean) => {
    try { toast((await api<{ message: string }>(`/adviser/memberships/${id}`, { body: { accept } })).message); void qc.invalidateQueries({ queryKey: ["adviser"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <PageHead label={d.incubator} title="Cohort board" sub="Your companies by support stage. Starter companies are ones you're helping to register." />
      <div className="grid-4">
        <div className="panel stat"><span className="label">Companies</span><span className="v">{d.tiles.companies}</span><span className="small muted">{d.tiles.starters} Starter</span></div>
        <div className="panel stat"><span className="label">Average readiness</span><span className="v">{d.tiles.avgReadiness}</span></div>
        <div className="panel stat"><span className="label">Documents to check</span><span className="v" style={{ color: d.tiles.toCheck ? "var(--warn)" : undefined }}>{d.tiles.toCheck}</span><Link className="btn ghost sm self-start" to="/adviser/checks">Open</Link></div>
        <div className="panel stat"><span className="label">Support sessions logged</span><span className="v">{d.tiles.sessions}</span></div>
      </div>
      {d.requests.length > 0 && (
        <section className="panel">
          <h2>Asking to join</h2>
          {d.requests.map((r) => (
            <div key={r.id} className="li"><div className="li-main"><b>{r.name}</b><span className="hint">{r.sector} · {r.town}</span></div>
              <div className="li-side"><div className="row" style={{ gap: 6 }}>
                <button className="btn sm primary" onClick={() => void decide(r.id, true)}>Accept</button>
                <button className="btn sm" onClick={() => void decide(r.id, false)}>Decline</button></div></div></div>
          ))}
        </section>
      )}
      <div className="board">{d.stages.map((s, i) => {
        const col = d.companies.filter((c) => c.stage === i);
        return (
          <div key={s} className="col">
            <div className="flex items-center justify-between px-1 pb-1.5"><span className="label">{s}</span><span className="mono small muted">{col.length}</span></div>
            {col.map((c) => (
              <button key={c.id} type="button" className="card" onClick={() => setOpen(c.id)}>
                <span className="row between" style={{ gap: 6 }}><b>{c.name}</b><LevelPill verified={c.verified} /></span>
                <span className="hint">{c.sector} · {c.town}</span>
                <ScoreCell score={c.score} />
                <span className="hint">Adviser: {c.adviser ?? "not assigned"}</span>
                {c.flags.length > 0 && <span className="row" style={{ gap: 4 }}>{c.flags.slice(0, 2).map((f) => <Pill key={f.code} tone={f.level}>{f.text}</Pill>)}{c.flags.length > 2 && <Pill tone="plain">+{c.flags.length - 2}</Pill>}</span>}
              </button>
            ))}
            {!col.length && <span className="hint p-1">None</span>}
          </div>
        );
      })}</div>
      {open && <AdviserDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
