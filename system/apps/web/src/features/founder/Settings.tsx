// Business settings (inventory 12.9): two-step sign-in, opening balance with a date, people, year founded.
import { todayZA } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { TwoFactorCard } from "../auth/TwoFactor";
import { FounderHead } from "./FounderHead";

interface SettingsData { openingBalance: number; openingBalanceDate: string; employees: number; foundedYear: number; stage: "Early" | "Growth" }

function BusinessForm({ s }: { s: SettingsData }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ ...s, openingBalance: String(s.openingBalance), employees: String(s.employees), foundedYear: String(s.foundedYear) });
  const save = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/settings", { method: "PUT", body: { openingBalance: Number(f.openingBalance) || 0, openingBalanceDate: f.openingBalanceDate, employees: Number(f.employees) || 1, foundedYear: Number(f.foundedYear), stage: f.stage } }),
    onSuccess: async (r) => { toast(r.message); await qc.invalidateQueries({ queryKey: ["founder"] }); await qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  return (
    <form className="panel stack" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <h2>Your business</h2>
      <p className="small muted">Cash on hand starts from your opening balance on its date, plus every entry since.</p>
      <div className="form-grid">
        <label className="field"><span>Opening balance (R)</span><input type="number" step="0.01" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} /></label>
        <label className="field"><span>On this date</span><input type="date" max={todayZA()} value={f.openingBalanceDate} onChange={(e) => setF({ ...f, openingBalanceDate: e.target.value })} /></label>
        <label className="field"><span>People working in the business</span><input type="number" min={1} value={f.employees} onChange={(e) => setF({ ...f, employees: e.target.value })} /></label>
        <label className="field"><span>Trading since (year)</span><input type="number" min={1950} max={Number(todayZA().slice(0, 4))} value={f.foundedYear} onChange={(e) => setF({ ...f, foundedYear: e.target.value })} /></label>
        <label className="field"><span>Stage</span><select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as SettingsData["stage"] })}><option>Early</option><option>Growth</option></select></label>
      </div>
      {save.error && <p className="err" role="alert">{(save.error as ApiError).message}</p>}
      <button className="btn primary self-start" type="submit" disabled={save.isPending}>Save</button>
    </form>
  );
}

export default function Settings() {
  const q = useQuery({ queryKey: ["founder", "settings"], queryFn: () => api<SettingsData>("/founder/settings") });
  return (
    <>
      <FounderHead title="Business settings" sub="Two-step sign-in, opening balance, people and the year you started trading." />
      <TwoFactorCard />
      {q.data ? <BusinessForm key={JSON.stringify(q.data)} s={q.data} /> : <Spinner />}
    </>
  );
}
