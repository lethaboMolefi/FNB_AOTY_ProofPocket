// The funder's part of the company drawer (v2/app.js funderDrawerPart): applications, offers, invite.
import { R } from "@proofpocket/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CompanyDrawer, type Drawer } from "../../components/CompanyDrawer";
import { Notice, Pill, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { OfferHistory, type Application } from "../founder/Funding";

type FunderDrawerData = Drawer & { applications: Application[]; invitable: { id: string; name: string; gaps: number }[] };

function AppCard({ a, refresh }: { a: Application; refresh: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(a.currentOffer));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const done = ["approved", "declined", "withdrawn"].includes(a.status);
  const call = async (path: string, body: object, confirmText?: string) => {
    setErr("");
    try { toast((await api<{ message: string }>(path, { body })).message); setReason(""); refresh(); }
    catch (e) {
      const x = e as ApiError;
      if (x.code === "over_budget" && window.confirm(x.message)) return call(path, { ...body, confirmOverBudget: true });
      setErr(confirmText ?? x.message);
    }
  };
  return (
    <div className="panel stack" style={{ background: "var(--surface-2)" }}>
      <div className="panel-head" style={{ margin: 0 }}><div><b>{a.programme}</b><div className="hint">Requested {R(a.requested)} · current offer {R(a.currentOffer)}</div></div><Pill tone={a.statusTone}>{a.statusLabel}</Pill></div>
      {a.reasonRequested && <Notice tone="warn" icon="?"><span className="small">The founder asked why the offer changed. Add a reason with your next change.</span></Notice>}
      <OfferHistory offers={a.offers} />
      {a.statusReason && <p className="small">{a.statusReason}</p>}
      {!done && (
        <form className="form-grid" noValidate onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) { setErr("Add a reason. Founders see every change to their offer."); return; } void call(`/funder/applications/${a.id}/offer`, { amount: Number(amount), reason }); }}>
          <label className="field"><span>New offer (R)</span><input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="field" style={{ gridColumn: "span 2" }}><span>Reason the founder will see</span><input type="text" placeholder="e.g. Quarterly budget reduced by 30%" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="row" style={{ gridColumn: "1/-1" }}>
            <button className="btn sm" type="submit">Change offer</button>
            <button className="btn sm primary" type="button" onClick={() => void call(`/funder/applications/${a.id}/approve`, { reason })}>Approve current offer</button>
            <button className="btn sm danger" type="button" onClick={() => (reason.trim() ? void call(`/funder/applications/${a.id}/decline`, { reason }) : setErr("Add a reason before declining. The founder will see it."))}>Decline</button>
            {a.status === "submitted" && <button className="btn sm ghost" type="button" onClick={() => void call(`/funder/applications/${a.id}/status`, { status: "under_review", reason })}>Mark under review</button>}
            <button className="btn sm ghost" type="button" onClick={() => (reason.trim() ? void call(`/funder/applications/${a.id}/status`, { status: "awaiting_cofunding", reason }) : setErr("Say what co-funding the founder needs to find."))}>Awaiting co-funding</button>
          </div>
          {err && <p className="err" role="alert" style={{ gridColumn: "1/-1" }}>{err}</p>}
        </form>
      )}
    </div>
  );
}

export function FunderDrawer({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [prog, setProg] = useState("");
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["drawer"] }); void qc.invalidateQueries({ queryKey: ["funder"] }); };
  return (
    <CompanyDrawer<FunderDrawerData> path={`/funder/companies/${companyId}`} onClose={onClose}>
      {(d) => (
        <div className="panel stack">
          <h3>Applications to you</h3>
          {d.applications.length ? d.applications.map((a) => <AppCard key={a.id} a={a} refresh={refresh} />) : <p className="small muted">No applications from this company yet.</p>}
          {d.invitable.length > 0 && (
            <div className="row" style={{ alignItems: "end" }}>
              <label className="field" style={{ flex: 1 }}><span>Invite to apply</span>
                <select value={prog} onChange={(e) => setProg(e.target.value)}><option value="">Choose a programme…</option>
                  {d.invitable.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.gaps ? `still needs ${p.gaps} thing${p.gaps > 1 ? "s" : ""}` : "qualifies now"}</option>)}</select></label>
              <button className="btn" disabled={!prog} onClick={() => void api<{ message: string }>(`/funder/companies/${companyId}/invite`, { body: { programmeId: prog } }).then((r) => { toast(r.message); refresh(); }, (e: ApiError) => toast(e.message))}>Send invite</button>
            </div>
          )}
        </div>
      )}
    </CompanyDrawer>
  );
}
