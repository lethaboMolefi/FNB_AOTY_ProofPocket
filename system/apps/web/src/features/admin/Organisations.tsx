// Admin: verify funders, incubators and buyers; invite their people; reset a lost authenticator.
import { ALL_SECTORS } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, KeyRound, Plus, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ToggleChips } from "../../components/ToggleChips";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

interface Person { id: string; email: string; name: string; role: string; isLead: boolean }
interface Org { id: string; type: "funder" | "incubator" | "buyer"; name: string; kind: string | null; verified: boolean; setupDone: boolean; example: boolean; people: Person[] }

const SUB = "Verify funders, incubators and buyers before founders see their badge, and invite their people. Only verified funders can see companies.";
const TITLES = { funder: "Funders and investors", incubator: "Incubators and NGOs", buyer: "Buyers" } as const;

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
    <form className="flex flex-wrap items-end gap-3 pt-2" onSubmit={submit} noValidate>
      <TextField className="min-w-[160px] flex-1" label="Name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
      <TextField className="min-w-[200px] flex-1" label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      {org.type === "incubator" && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.isLead} onChange={(e) => setF({ ...f, isLead: e.target.checked })} />Lead adviser</label>}
      <Button type="submit" variant="outline"><UserPlus className="h-4 w-4" />Invite</Button>
      {err && <Callout tone="bad" role="alert" className="w-full">{err}</Callout>}
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
  if (!q.data) return <><PageHeader label="ProofPocket admin" title="Organisations" sub={SUB} /><Spinner /></>;
  return (
    <>
      <PageHeader label="ProofPocket admin" title="Organisations" sub={SUB} />
      <Card>
        <form onSubmit={create} noValidate>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" aria-hidden="true" />Add an organisation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <NativeSelect label="Type" value={n.type} onChange={(e) => setN({ ...n, type: e.target.value as Org["type"] })}>
                <option value="funder">Funder or investor</option><option value="incubator">Incubator or NGO</option><option value="buyer">Buyer</option>
              </NativeSelect>
              <TextField label="Name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
              <TextField label={n.type === "buyer" ? "Kind (e.g. Retail)" : "Kind (optional)"} value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value })} />
              {n.type === "buyer" && <TextField className="sm:col-span-3" label="What they're looking for" value={n.wants} onChange={(e) => setN({ ...n, wants: e.target.value })} />}
            </div>
            {n.type === "buyer" && <ToggleChips legend="Sectors they buy from" options={ALL_SECTORS.map((x) => ({ value: x, label: x }))} value={n.sectors} onChange={(sectors) => setN({ ...n, sectors })} />}
            {err && <Callout tone="bad" role="alert">{err}</Callout>}
            <Button type="submit">Add (not verified yet)</Button>
          </CardContent>
        </form>
      </Card>
      {(["funder", "incubator", "buyer"] as const).map((t) => {
        const orgs = q.data.organisations.filter((o) => o.type === t);
        return (
          <Card key={t}>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" aria-hidden="true" />{TITLES[t]}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {orgs.length ? <ul>{orgs.map((o) => (
                <li key={o.id} className="space-y-2 border-b border-border py-4 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2 text-sm"><b>{o.name}</b>{o.kind && <span className="text-muted-foreground">· {o.kind}</span>}
                      {o.example && <ToneBadge tone="plain">Example</ToneBadge>}{t === "funder" && !o.setupDone && <ToneBadge tone="warn">Set-up not done</ToneBadge>}</span>
                    <div className="flex items-center gap-2">
                      {o.verified ? <ToneBadge tone="good">Verified</ToneBadge> : <ToneBadge tone="warn">Not verified</ToneBadge>}
                      <Button size="sm" variant="outline" onClick={() => void call(`/admin/organisations/${o.id}/verified`, { verified: !o.verified }, o.verified ? `Remove ${o.name}'s verified badge?` : undefined)}>
                        <BadgeCheck className="h-4 w-4" />{o.verified ? "Unverify" : "Verify"}
                      </Button>
                    </div>
                  </div>
                  {t !== "buyer" && <>
                    {o.people.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>{p.name}{p.isLead ? " (lead)" : ""} · <span className="font-mono text-xs">{p.email}</span></span>
                        <Button size="sm" variant="ghost" onClick={() => void call(`/admin/users/${p.id}/reset-authenticator`, {}, `Reset ${p.name}'s Google Authenticator? Only do this after checking who they are. They'll set it up again at their next sign-in.`)}>
                          <KeyRound className="h-4 w-4" />Reset authenticator
                        </Button>
                      </div>
                    ))}
                    <Invite org={o} done={refresh} />
                  </>}
                </li>
              ))}</ul> : <EmptyState icon={Building2}>None yet.</EmptyState>}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
