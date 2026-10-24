// Privacy & sharing (v2/app.js vPrivacy), plus choosing or leaving an incubator (inventory 12.12).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

type Sharing = "none" | "summary" | "full";
interface Data { sharing: Sharing; incubators: { id: string; name: string }[]; incubator: { id: string; name: string } | null; adviser: string | null; pendingRequest: { name: string } | null }

const OPTIONS: [Sharing, string, string][] = [
  ["none", "Nothing", "Funders can't find you. Applying to a programme still shares your profile with that funder only."],
  ["summary", "Summary", "Readiness score, document status (not the files) and monthly totals."],
  ["full", "Full books", "Everything in Summary, plus each entry in your books. Funders with full access can decide faster."],
];

export default function Privacy() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "privacy"], queryFn: () => api<Data>("/founder/privacy") });
  const [choice, setChoice] = useState("");
  const done = async (r: { message: string }) => { toast(r.message); await qc.invalidateQueries({ queryKey: ["founder"] }); };
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Try again.");
  if (!q.data) return <><FounderHead title="Privacy & sharing" sub="You decide who sees what. You can change this at any time." /><Spinner /></>;
  const d = q.data;
  const setSharing = (s: Sharing) => api<{ message: string }>("/founder/privacy", { method: "PUT", body: { sharing: s } }).then(done, fail);
  const incubator = (id: string | null) => api<{ message: string }>("/founder/incubator", { body: { incubatorId: id } }).then(done, fail);
  return (
    <>
      <FounderHead title="Privacy & sharing" sub="You decide who sees what. You can change this at any time." />
      <fieldset className="panel stack">
        <legend className="sr-only">What verified funders can see</legend>
        <h2>What verified funders can see</h2>
        {OPTIONS.map(([v, t, desc]) => (
          <label key={v} className="radio-card">
            <input type="radio" name="sharing" value={v} checked={d.sharing === v} onChange={() => void setSharing(v)} />
            <span><b>{t}</b><span className="hint">{desc}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="grid-2">
        <section className="panel">
          <h2>Always private</h2>
          {["Your document files. Others see only whether they're checked.", "Your ID number and bank account number.", "Personal purchases you've marked."].map((t) => <div key={t} className="li"><span className="small">{t}</span></div>)}
        </section>
        <section className="panel stack">
          <h2>Your incubator</h2>
          <p className="small">{d.incubator
            ? `${d.incubator.name} supports you and can see your books and documents in order to help. Adviser: ${d.adviser ?? "not assigned yet"}.`
            : "You haven't chosen an incubator."}</p>
          {d.pendingRequest && <p className="small">You asked to join <b>{d.pendingRequest.name}</b>. They'll accept you soon.</p>}
          {d.incubator && <button className="btn sm danger self-start" onClick={() => window.confirm(`Leave ${d.incubator!.name}? Your adviser will no longer see your records.`) && void incubator(null)}>Leave {d.incubator.name}</button>}
          <div className="row" style={{ alignItems: "end" }}>
            <label className="field" style={{ flex: 1 }}><span>{d.incubator ? "Move to another incubator" : "Ask an incubator to support you"}</span>
              <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Choose…</option>
                {d.incubators.filter((i) => i.id !== d.incubator?.id).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <button className="btn" disabled={!choice} onClick={() => void incubator(choice)}>Send request</button>
          </div>
        </section>
      </div>
    </>
  );
}
