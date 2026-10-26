// Public directory and business profiles (v2/app.js vDirectory, profileHTML). No account needed.
import { shortDate } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Flag, MessageCircle, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { EmptyState } from "../../components/EmptyState";
import { TopBar } from "../../components/layout/TopBar";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

/** Public pages: the same top bar and spacing as the portals, without a sidebar. */
export function PublicShell({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <TopBar home="/directory" />
      <main id="main" className={`mx-auto flex flex-col gap-6 px-4 pb-12 pt-6 ${narrow ? "max-w-[640px]" : "max-w-[1100px]"}`}>{children}</main>
    </>
  );
}

interface Biz { slug: string; name: string; sector: string; town: string; province: string; tagline: string }

export function Directory() {
  const q = useQuery({ queryKey: ["public", "directory"], queryFn: () => api<{ businesses: Biz[]; featured: { slug: string; name: string; town: string; text: string; date: string }[] }>("/public/directory") });
  const [f, setF] = useState({ q: "", sector: "" });
  const d = q.data;
  const sectors = d ? [...new Set(d.businesses.map((b) => b.sector))].sort() : [];
  const rows = d ? d.businesses.filter((b) => (!f.q || `${b.name} ${b.town} ${b.sector} ${b.tagline}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.sector || b.sector === f.sector)) : [];
  return (
    <PublicShell>
      <PageHeader title="Verified local businesses" sub="Every business here has shown ProofPocket its CIPC registration, owner ID, business bank account and address. Scan a business's QR code to check it." />
      {!d ? <Spinner /> : <>
        {d.featured.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Featured this week</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">{d.featured.map((p, i) => (
              <Link key={i} to={`/b/${p.slug}`} className="flex flex-col gap-1 rounded-lg border border-border p-4 text-foreground no-underline transition-colors hover:border-primary/40 hover:bg-surface-2">
                <span className="flex items-center justify-between gap-2"><b>{p.name}</b><ToneBadge tone="good">Verified</ToneBadge></span>
                <span className="text-sm">{p.text}</span>
                <span className="text-xs text-muted-foreground">{p.town} · {shortDate(p.date)}</span>
              </Link>
            ))}</CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
            <TextField label="Search" placeholder="e.g. catering Mamelodi" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <NativeSelect label="Sector" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}>
              <option value="">All</option>{sectors.map((s) => <option key={s}>{s}</option>)}
            </NativeSelect>
          </CardContent>
        </Card>
        {rows.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((b) => (
            <Link key={b.slug} to={`/b/${b.slug}`} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-foreground no-underline shadow-sm transition-colors hover:border-primary/40">
              <span className="flex items-center justify-between gap-2"><b>{b.name}</b><ToneBadge tone="good">Verified</ToneBadge></span>
              <span className="text-sm">{b.tagline || b.sector}</span>
              <span className="text-xs text-muted-foreground">{b.sector} · {b.town}, {b.province}</span>
            </Link>
          ))}</div>
        ) : <EmptyState icon={Search}>No businesses match.</EmptyState>}
      </>}
    </PublicShell>
  );
}

export function BusinessProfile() {
  const { slug = "" } = useParams();
  const toast = useToast();
  const q = useQuery({ queryKey: ["public", "b", slug], queryFn: () => api<{ name: string; sector: string; town: string; province: string; foundedYear: number; verified: boolean; tagline: string; services: string; whatsapp: string; instagram: string; hours: string }>(`/public/b/${slug}`), retry: false });
  const report = async () => {
    const reason = window.prompt("What happened? (optional)");
    if (reason === null) return;
    try { toast((await api<{ message: string }>(`/public/b/${slug}/report`, { body: { reason } })).message); } catch (e) { toast((e as ApiError).message); }
  };
  if (q.isError) return (
    <PublicShell>
      <PageHeader title="Business not found" />
      <Callout tone="bad" role="alert">This business isn't on ProofPocket. Check the link, and be careful: someone may be pretending to be listed.</Callout>
    </PublicShell>
  );
  if (!q.data) return <PublicShell><Spinner /></PublicShell>;
  const p = q.data;
  const wa = p.whatsapp.replace(/\D/g, "").replace(/^0/, "");
  const checked = p.verified ? ["CIPC registration certificate", "Owner ID copy", "Business bank account confirmation", "Proof of business address"] : ["Owner ID copy", "Proof of business address"];
  return (
    <PublicShell>
      <PageHeader title={p.name} sub={`${p.sector} · ${p.town}, ${p.province}`} />
      {p.verified
        ? <Callout tone="good"><b>Verified on ProofPocket.</b> Trading since {p.foundedYear}.</Callout>
        : <Callout tone="warn"><b>Starter: not verified yet.</b> ProofPocket has checked this owner's ID and address, but not yet the business registration and bank account.</Callout>}
      <Card>
        <CardHeader className="pb-3">{p.tagline && <CardDescription className="text-base text-foreground">{p.tagline}</CardDescription>}<CardTitle className="text-base">Services</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {p.services ? <ul className="divide-y divide-border">{p.services.split("\n").filter(Boolean).map((s, i) => <li key={i} className="py-2 text-sm">{s}</li>)}</ul>
            : <p className="text-sm text-muted-foreground">No services listed yet.</p>}
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0 text-sm">
            {p.whatsapp && <span>WhatsApp <span className="font-mono">{p.whatsapp}</span></span>}
            {p.instagram && <span>Instagram {p.instagram}</span>}
            {p.hours && <span className="text-muted-foreground">{p.hours}</span>}
            {wa && <Button asChild className="mt-1 self-start"><a href={`https://wa.me/27${wa}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />Message on WhatsApp</a></Button>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">What ProofPocket checked</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0 text-sm">
            {checked.map((x) => <span key={x} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-good" aria-hidden="true" />{x}</span>)}
            <span className="text-xs text-muted-foreground">ProofPocket checks documents, not the quality of work.</span>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Something wrong?</CardTitle><CardDescription>If this business asked you to pay in a way that felt unsafe, tell us.</CardDescription></CardHeader>
        <CardContent className="pt-0"><Button variant="destructive" onClick={() => void report()}><Flag className="h-4 w-4" />Report this business</Button></CardContent>
      </Card>
    </PublicShell>
  );
}
