// Fraud protection (v2/app.js vProtection), plus "Check a message" (inventory 12.2).
import { DOCS, shortDate, shortFingerprint, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Notice, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface Msg { id: string; sender: string; address: string; verified: boolean; body: string; flags: string[]; status: "open" | "blocked" | "safe"; date: string; kind: string }
interface Supplier { id: string; name: string; bank: string; pending: { bank: string; since: string } | null }
interface Data { messages: Msg[]; suppliers: Supplier[]; fingerprints: { docType: DocType; fileName: string | null; sha256: string; status: string }[] }

const SUB = "Scam warnings, holds on changed bank details, and a fingerprint of every document you upload.";

function CheckMessage({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ sender: "", text: "" });
  const [res, setRes] = useState<{ flags: string[]; reports: number; confirmedScam: boolean } | null>(null);
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { setRes(await api("/founder/check-message", { body: f })); onDone(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <h2>Check a message</h2>
      <p className="small muted">Got a WhatsApp, SMS or email offering money or asking you to pay? Paste it here before you reply.</p>
      <div className="form-grid">
        <label className="field"><span>From (email address or number)</span><input type="text" value={f.sender} onChange={(e) => setF({ ...f, sender: e.target.value })} /></label>
        <label className="field" style={{ gridColumn: "1/-1" }}><span>The message</span><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary self-start" type="submit">Check it</button>
      {res && (res.flags.length
        ? <Notice tone="bad" icon="!"><div className="small"><b>{res.flags.length} warning sign{res.flags.length > 1 ? "s" : ""}. Don't pay and don't share codes.</b>
            <ul className="mt-1" style={{ paddingLeft: 18, listStyle: "disc" }}>{res.flags.map((x) => <li key={x}>{x}</li>)}</ul>
            {res.reports > 0 && <span>{res.reports} founder{res.reports > 1 ? "s" : ""} reported this sender{res.confirmedScam ? ", and ProofPocket confirmed it's a scam" : ""}.</span>}
            <span> It's saved below so you can report it.</span></div></Notice>
        : <Notice tone="good" icon="✓"><span className="small">No warning signs found. Still, never pay a fee to receive money, and check with your adviser if you're unsure.</span></Notice>)}
    </form>
  );
}

export default function Protection() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "protection"], queryFn: () => api<Data>("/founder/protection") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["founder"] });
  const call = async (path: string, body: object = {}) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void refresh(); }
    catch (e) { toast((e as ApiError).message); }
  };
  const changeBank = async (s: Supplier) => {
    const bank = window.prompt(`New bank for ${s.name} (as they told you)`);
    if (!bank) return;
    const acc = window.prompt("New account number (or its last 4 digits)");
    if (!acc) return;
    try { toast((await api<{ message: string }>(`/founder/suppliers/${s.id}/bank`, { method: "PUT", body: { bank, accountNumber: acc } })).message); void refresh(); }
    catch (e) { toast((e as ApiError).message); }
  };
  if (!q.data) return <><FounderHead title="Fraud protection" sub={SUB} /><Spinner /></>;
  const d = q.data;
  return (
    <>
      <FounderHead title="Fraud protection" sub={SUB} />
      <section className="panel">
        <h2>Messages about money</h2>
        {d.messages.length ? d.messages.map((m) => (
          <div key={m.id} className="li">
            <div className="li-main">
              <span><b>{m.sender}</b> {m.verified ? <Pill tone="good">Verified on ProofPocket</Pill> : <Pill tone="bad">Not verified</Pill>}</span>
              <span className="hint">{m.address} · {shortDate(m.date)}</span>
              <p className="small mt-1">“{m.body}”</p>
              {m.flags.length > 0 && <div className="row mt-1" style={{ gap: 4 }}>{m.flags.map((x) => <Pill key={x} tone="bad">{x}</Pill>)}</div>}
            </div>
            <div className="li-side">
              {m.status === "open" && !m.verified ? <>
                <button className="btn sm danger" onClick={() => void call(`/founder/messages/${m.id}`, { action: "block" })}>Report and block</button>
                <button className="btn sm" onClick={() => void call(`/founder/messages/${m.id}`, { action: "safe" })}>It's genuine</button>
              </> : m.status === "blocked" ? <Pill tone="plain">Reported and blocked</Pill> : m.status === "safe" && !m.verified ? <Pill tone="plain">Marked genuine</Pill> : null}
            </div>
          </div>
        )) : <p className="muted">No messages.</p>}
      </section>
      <CheckMessage onDone={() => void refresh()} />
      <section className="panel">
        <h2>Supplier bank details</h2>
        {d.suppliers.length ? d.suppliers.map((s) => (
          <div key={s.id} className="li">
            <div className="li-main">
              <span><b>{s.name}</b> · {s.bank}</span>
              {s.pending
                ? <span className="small text-bad">New details received {shortDate(s.pending.since)}: {s.pending.bank}. Payments are on hold until you confirm by phone, on a number you already had.</span>
                : <span className="hint">No changes</span>}
            </div>
            <div className="li-side">
              {s.pending ? <>
                <button className="btn sm" onClick={() => void call(`/founder/suppliers/${s.id}/confirm`)}>I've confirmed by phone</button>
                <button className="btn sm danger" onClick={() => void call(`/founder/suppliers/${s.id}/reject`)}>Reject change</button>
              </> : <>
                <Pill tone="good">Unchanged</Pill>
                <button className="btn sm ghost" onClick={() => void changeBank(s)}>Supplier sent new details</button>
              </>}
            </div>
          </div>
        )) : <p className="muted">No suppliers saved. Add one under Payments.</p>}
      </section>
      <div className="grid-2">
        <section className="panel">
          <h2>Document fingerprints</h2>
          <p className="small muted mb-2">If a file is changed after it was checked, the fingerprint stops matching and funders are warned.</p>
          {d.fingerprints.length ? d.fingerprints.map((f) => (
            <div key={f.docType} className="li"><span className="small">{DOCS[f.docType].name}</span><span className="fp">{shortFingerprint(f.sha256)}</span></div>
          )) : <p className="muted small">No documents yet.</p>}
        </section>
        <section className="panel">
          <h2>Rules that keep you safe</h2>
          {["Verified funders and incubators show a badge. Anyone else offering funding is a warning sign.",
            "Be wary of any request to pay a fee before money is released. Check with your adviser first.",
            "When a supplier changes bank details, ProofPocket holds payments until you confirm by phone.",
            "ProofPocket will never ask for your banking PIN, password or Google Authenticator code."].map((t) => <div key={t} className="li"><span className="small">{t}</span></div>)}
        </section>
      </div>
    </>
  );
}
