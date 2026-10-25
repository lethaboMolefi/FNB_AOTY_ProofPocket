// Public directory and business profiles (v2/app.js vDirectory, profileHTML). No account needed.
import { shortDate } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { TopBar } from "../../components/layout/TopBar";
import { LevelPill, Notice, PageHead, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar home="/directory" />
      <main id="main" className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pb-12 pt-5">{children}</main>
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
    <Shell>
      <PageHead label="ProofPocket directory" title="Verified local businesses" sub="Every business here has shown ProofPocket its CIPC registration, owner ID, business bank account and address. Scan a business's QR code to check it." />
      {!d ? <Spinner /> : <>
        {d.featured.length > 0 && <section className="panel"><h2>Featured this week</h2><div className="grid-2">{d.featured.map((p, i) => (
          <Link key={i} to={`/b/${p.slug}`} className="feature"><span className="row between" style={{ gap: 6 }}><b>{p.name}</b><Pill tone="good">Verified</Pill></span><span className="small">{p.text}</span><span className="hint">{p.town} · {shortDate(p.date)}</span></Link>
        ))}</div></section>}
        <div className="panel"><div className="form-grid">
          <label className="field"><span>Search</span><input type="text" placeholder="e.g. catering Mamelodi" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
          <label className="field"><span>Sector</span><select value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}><option value="">All</option>{sectors.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div></div>
        <div className="grid-3">{rows.map((b) => (
          <Link key={b.slug} to={`/b/${b.slug}`} className="panel bizcard"><span className="row between" style={{ gap: 6 }}><b>{b.name}</b><Pill tone="good">Verified</Pill></span>
            <span className="small">{b.tagline || b.sector}</span><span className="hint">{b.sector} · {b.town}, {b.province}</span></Link>
        ))}{!rows.length && <p className="muted">No businesses match.</p>}</div>
      </>}
    </Shell>
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
  if (q.isError) return <Shell><Notice tone="bad" icon="!"><span className="small">This business isn't on ProofPocket. Check the link, and be careful: someone may be pretending to be listed.</span></Notice></Shell>;
  if (!q.data) return <Shell><Spinner /></Shell>;
  const p = q.data;
  const wa = p.whatsapp.replace(/\D/g, "").replace(/^0/, "");
  return (
    <Shell>
      <PageHead label={`${p.sector} · ${p.town}, ${p.province}`} title={p.name} side={<LevelPill verified={p.verified} />} />
      {p.verified
        ? <Notice tone="good" icon="✓"><span className="small"><b>Verified on ProofPocket.</b> Trading since {p.foundedYear}.</span></Notice>
        : <Notice tone="warn" icon="!"><span className="small"><b>Starter: not verified yet.</b> ProofPocket has checked this owner's ID and address, but not yet the business registration and bank account.</span></Notice>}
      <section className="panel stack"><p>{p.tagline}</p><div className="label">Services</div>
        {p.services.split("\n").filter(Boolean).map((s, i) => <div key={i} className="li"><span className="small">{s}</span></div>)}
        {!p.services && <span className="hint">No services listed yet.</span>}</section>
      <div className="grid-2">
        <section className="panel stack"><div className="label">Contact</div>
          {p.whatsapp && <span>WhatsApp <span className="mono">{p.whatsapp}</span></span>}{p.instagram && <span>Instagram {p.instagram}</span>}<span className="hint">{p.hours}</span>
          {wa && <a className="btn sm primary self-start" href={`https://wa.me/27${wa}`} target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>}</section>
        <section className="panel stack"><div className="label">What ProofPocket checked</div>
          {(p.verified ? ["CIPC registration certificate", "Owner ID copy", "Business bank account confirmation", "Proof of business address"] : ["Owner ID copy", "Proof of business address"]).map((x) => <span key={x} className="small">✓ {x}</span>)}
          <span className="hint">ProofPocket checks documents, not the quality of work.</span></section>
      </div>
      <section className="panel stack"><div className="label">Something wrong?</div><p className="small">If this business asked you to pay in a way that felt unsafe, tell us.</p>
        <button className="btn sm danger self-start" onClick={() => void report()}>Report this business</button></section>
    </Shell>
  );
}
