// Funding readiness (v2/app.js vFunding).
import { R, shortDate, type ReadinessItem, type Tone } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Checklist, Ring } from "../../components/charts";
import { Notice, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

export interface Offer { amount: number; date: string; reason: string }
export interface Application {
  id: string; company: string; companyId: string; programme: string; funder: string; requested: number; appliedOn: string; status: string; statusLabel: string; statusTone: Tone;
  statusReason: string; reasonRequested: boolean; offers: Offer[]; currentOffer: number; changedWithoutReason: boolean; canAskReason?: boolean; canWithdraw?: boolean;
}
interface Data {
  verified: boolean; readiness: { score: number; label: string; tone: Tone; items: ReadinessItem[] };
  programmes: { id: string; name: string; funder: string; kind: string | null; min: number; max: number; left: number; gaps: string[]; applied: boolean }[];
  applications: Application[];
}
const SUB = "Funders set their own requirements on ProofPocket. See what each one checks, and what you still need, before you apply.";

export function OfferHistory({ offers }: { offers: Offer[] }) {
  return (
    <div>{offers.map((o, i) => (
      <div key={i} className="tl"><span className="when">{shortDate(o.date)}</span>
        <span><b className="num">{R(o.amount)}</b>{i ? " · " : " "}{o.reason ? o.reason : <span style={{ color: "var(--bad)", fontWeight: 600 }}>No reason given</span>}</span></div>
    ))}</div>
  );
}

export default function Funding() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "funding"], queryFn: () => api<Data>("/founder/funding") });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  if (!q.data) return <><FounderHead title="Funding readiness" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const act = async (path: string, body: object = {}) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["founder"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <FounderHead title="Funding readiness" sub={SUB} />
      {!d.verified && <Notice tone="warn" icon="!" action={<Link className="btn sm ml-auto" to="/app/start">Get verified</Link>}>
        <b>Funders can't see you yet</b> <span className="small">You can see your score and every programme's requirements now. You can apply once you're verified.</span>
      </Notice>}
      <div className="grid-3">
        <section className="panel"><div className="row" style={{ gap: 18 }}><Ring score={d.readiness.score} />
          <div className="stack" style={{ gap: 6 }}><span><Pill tone={d.readiness.tone}>{d.readiness.label}</Pill></span><span className="small muted">From your checked documents and the state of your books. Funders see the same score.</span></div></div></section>
        <section className="panel span-2"><h2>What makes up your score</h2>
          <div className="grid-2">
            <div><div className="label mb-1">Documents</div><Checklist items={d.readiness.items.filter((i) => i.group === "Documents")} /></div>
            <div><div className="label mb-1">Bookkeeping</div><Checklist items={d.readiness.items.filter((i) => i.group === "Bookkeeping")} /></div>
          </div></section>
      </div>
      <section className="panel" style={{ padding: 0 }}>
        <div className="panel-head" style={{ padding: "16px 18px 0" }}><h2>Programmes and what you're missing</h2><span className="small muted">Only verified funders are listed</span></div>
        <div className="table-wrap flush"><table>
          <thead><tr><th>Programme</th><th>Amount</th><th>Funds left</th><th>What you still need</th><th>Apply</th></tr></thead>
          <tbody>{d.programmes.map((p) => (
            <tr key={p.id}>
              <td><b>{p.name}</b><div className="hint">{p.funder} · {p.kind} <Pill tone="good">Verified funder</Pill></div></td>
              <td className="num">{R(p.min)}–{R(p.max)}</td><td className="num">{R(p.left)}</td>
              <td>{p.gaps.length ? <div className="row" style={{ gap: 4 }}>{p.gaps.map((g) => <span key={g} className="chip">× {g}</span>)}</div> : <Pill tone="good">Nothing, you qualify</Pill>}</td>
              <td>{p.applied ? <Pill tone="info">Applied</Pill> : p.gaps.length ? <span className="small muted">—</span> : (
                <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <input type="number" aria-label={`Amount to request from ${p.name}`} min={p.min} max={p.max} value={amounts[p.id] ?? String(p.max)} onChange={(e) => setAmounts({ ...amounts, [p.id]: e.target.value })} style={{ width: 120 }} />
                  <button className="btn sm primary" onClick={() => void act("/founder/applications", { programmeId: p.id, amount: Number(amounts[p.id] ?? p.max) })}>Apply</button>
                </div>)}</td>
            </tr>
          ))}{!d.programmes.length && <tr><td colSpan={5} className="muted">No programmes yet.</td></tr>}</tbody>
        </table></div>
      </section>
      <section className="panel">
        <h2>Your applications</h2>
        {d.applications.length ? <div className="grid-2">{d.applications.map((a) => (
          <div key={a.id} className="panel" style={{ background: "var(--surface-2)" }}>
            <div className="panel-head"><div><h3>{a.programme}</h3><span className="hint">{a.funder} · applied {shortDate(a.appliedOn)}</span></div><Pill tone={a.statusTone}>{a.statusLabel}</Pill></div>
            <div className="row between mb-2"><span className="small muted">Requested <b className="num">{R(a.requested)}</b></span><span className="small muted">Current offer <b className="num">{R(a.currentOffer)}</b></span></div>
            <div className="label mb-1">Offer history</div><OfferHistory offers={a.offers} />
            {a.statusReason && <p className="small mt-2">{a.statusReason}</p>}
            <div className="row mt-2">
              {a.changedWithoutReason && <button className="btn sm" disabled={!a.canAskReason} onClick={() => void act(`/founder/applications/${a.id}/ask-reason`)}>{a.reasonRequested ? "Reason requested" : "Ask the funder for a reason"}</button>}
              {a.canWithdraw && <button className="btn sm ghost" onClick={() => window.confirm(`Withdraw your ${a.programme} application?`) && void act(`/founder/applications/${a.id}/withdraw`)}>Withdraw</button>}
            </div>
          </div>
        ))}</div> : <p className="muted">No applications yet.</p>}
      </section>
    </>
  );
}
