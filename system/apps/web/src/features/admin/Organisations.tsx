// Admin: verify funders, incubators and buyers; invite their people; reset a lost authenticator.
import { ALL_SECTORS } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { PageHead, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

interface Person { id: string; email: string; name: string; role: string; isLead: boolean }
interface Org { id: string; type: "funder" | "incubator" | "buyer"; name: string; kind: string | null; verified: boolean; setupDone: boolean; example: boolean; people: Person[] }

function Invite({ org, done }: { org: Org; done: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ email: "", displayName: "", isLead: false });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { toast((await api<{ message: string }>("/admin/users", { body: { ...f, orgId: org.id } })).message); setF({ email: "", displayName: "", isLead: false }); done(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <form className="row mt-2" style={{ alignItems: "end" }} onSubmit={submit} noValidate>
      <label className="field" style={{ flex: 1, minWidth: 160 }}><span>Name</span><input type="text" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></label>
      <label className="field" style={{ flex: 1, minWidth: 200 }}><span>Email</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      {org.type === "incubator" && <label className="check"><input type="checkbox" checked={f.isLead} onChange={(e) => setF({ ...f, isLead: e.target.checked })} />Lead adviser</label>}
      <button className="btn" type="submit">Invite</button>
      {err && <p className="err w-full" role="alert">{err}</p>}
    </form>
  );
}

export default function Organisations() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => api<{ organisations: Org[]; staff: Person[] }>("/admin/organisations") });
  const [n, setN] = useState({ type: "funder" as Org["type"], name: "", kind: "", wants: "", sectors: [] as string[] });
  const [err, setErr] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin"] });
  const call = async (path: string, body: object, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    try { toast((await api<{ message: string }>(path, { body })).message); refresh(); } catch (e) { toast((e as ApiError).message); }
  };
  const create = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { toast((await api<{ message: string }>("/admin/organisations", { body: n })).message); setN({ ...n, name: "", kind: "", wants: "", sectors: [] }); refresh(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  if (!q.data) return <><PageHead title="Organisations" /><Spinner /></>;
  return (
    <>
      <PageHead label="ProofPocket admin" title="Organisations" sub="Verify funders, incubators and buyers before founders see their badge, and invite their people. Only verified funders can see companies." />
      <form className="panel stack" onSubmit={create} noValidate>
        <h2>Add an organisation</h2>
        <div className="form-grid">
          <label className="field"><span>Type</span><select value={n.type} onChange={(e) => setN({ ...n, type: e.target.value as Org["type"] })}><option value="funder">Funder or investor</option><option value="incubator">Incubator or NGO</option><option value="buyer">Buyer</option></select></label>
          <label className="field"><span>Name</span><input type="text" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></label>
          <label className="field"><span>{n.type === "buyer" ? "Kind (e.g. Retail)" : "Kind (optional)"}</span><input type="text" value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value })} /></label>
          {n.type === "buyer" && <label className="field" style={{ gridColumn: "1/-1" }}><span>What they're looking for</span><input type="text" value={n.wants} onChange={(e) => setN({ ...n, wants: e.target.value })} /></label>}
        </div>
        {n.type === "buyer" && <div className="row" style={{ gap: 6 }}>{ALL_SECTORS.map((s) => (
          <label key={s} className="chip"><input type="checkbox" checked={n.sectors.includes(s)} onChange={(e) => setN({ ...n, sectors: e.target.checked ? [...n.sectors, s] : n.sectors.filter((x) => x !== s) })} /> {s}</label>
        ))}</div>}
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary self-start" type="submit">Add (not verified yet)</button>
      </form>
      {(["funder", "incubator", "buyer"] as const).map((t) => (
        <section key={t} className="panel">
          <h2>{t === "funder" ? "Funders and investors" : t === "incubator" ? "Incubators and NGOs" : "Buyers"}</h2>
          {q.data.organisations.filter((o) => o.type === t).map((o) => (
            <div key={o.id} className="li" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className="row between">
                <span><b>{o.name}</b> {o.kind && <span className="hint">· {o.kind}</span>} {o.example && <Pill tone="plain">Example</Pill>} {t === "funder" && !o.setupDone && <Pill tone="warn">Set-up not done</Pill>}</span>
                <div className="row" style={{ gap: 6 }}>{o.verified ? <Pill tone="good">Verified</Pill> : <Pill tone="warn">Not verified</Pill>}
                  <button className="btn sm" onClick={() => void call(`/admin/organisations/${o.id}/verified`, { verified: !o.verified }, o.verified ? `Remove ${o.name}'s verified badge?` : undefined)}>{o.verified ? "Unverify" : "Verify"}</button></div>
              </div>
              {t !== "buyer" && <>
                {o.people.map((p) => (
                  <div key={p.id} className="row between small mt-1"><span>{p.name}{p.isLead ? " (lead)" : ""} · <span className="mono">{p.email}</span></span>
                    <button className="btn sm ghost" onClick={() => void call(`/admin/users/${p.id}/reset-authenticator`, {}, `Reset ${p.name}'s Google Authenticator? Only do this after checking who they are. They'll set it up again at their next sign-in.`)}>Reset authenticator</button></div>
                ))}
                <Invite org={o} done={refresh} />
              </>}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
